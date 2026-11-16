import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const WORKSPACE_ROOT = path.join(os.tmpdir(), "hydrogen-workspaces");
const MAX_OUTPUT_BYTES = 200_000;
const EXEC_TIMEOUT_MS = 45_000;

const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".md",
  ".mdx",
  ".txt",
  ".svg",
  ".yml",
  ".yaml",
  ".sh",
]);

function isSyncableFile(relPath: string, sizeBytes?: number): boolean {
  if (sizeBytes !== undefined && sizeBytes > 200_000) return false;
  const normalized = relPath.replace(/\\/g, "/");
  if (
    normalized.startsWith(".git/") ||
    normalized === ".git" ||
    normalized.startsWith("node_modules/") ||
    normalized === "node_modules" ||
    normalized.startsWith("dist/")
  ) {
    return false;
  }
  const base = path.posix.basename(normalized);
  if (
    base === ".gitignore" ||
    base === ".env.example" ||
    base === "README" ||
    base === "LICENSE"
  ) {
    return true;
  }
  const ext = path.posix.extname(base).toLowerCase();
  return ext !== "" && TEXT_EXTENSIONS.has(ext);
}

function listWorkspaceFiles(dir: string, rootDir = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listWorkspaceFiles(full, rootDir));
    } else if (entry.isFile()) {
      results.push(path.relative(rootDir, full).replace(/\\/g, "/"));
    }
  }
  return results;
}

function syncProjectFilesToDisk(
  workspaceDir: string,
  files: Record<string, string>
) {
  fs.mkdirSync(workspaceDir, { recursive: true });

  const normalizedFiles = new Map<string, string>();
  for (const [rawPath, content] of Object.entries(files)) {
    const clean = rawPath.replace(/^\/+/, "").replace(/\\/g, "/");
    if (!clean || clean.includes("..") || clean.startsWith(".git/")) continue;
    normalizedFiles.set(clean, content);
  }

  // Remove files no longer in Studio project (keep .git and node_modules intact)
  const existing = listWorkspaceFiles(workspaceDir);
  for (const rel of existing) {
    if (!normalizedFiles.has(rel)) {
      const target = path.join(workspaceDir, rel);
      try {
        fs.unlinkSync(target);
      } catch {
        // Ignore unlink errors
      }
    }
  }

  // Write updated or missing files
  for (const [rel, content] of normalizedFiles.entries()) {
    const target = path.join(workspaceDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    let needsWrite = true;
    if (fs.existsSync(target)) {
      try {
        if (fs.readFileSync(target, "utf8") === content) {
          needsWrite = false;
        }
      } catch {
        needsWrite = true;
      }
    }
    if (needsWrite) {
      fs.writeFileSync(target, content, "utf8");
    }
  }
}

function readWorkspaceFiles(workspaceDir: string): Record<string, string> {
  const result: Record<string, string> = {};
  const allPaths = listWorkspaceFiles(workspaceDir).sort();
  let count = 0;

  for (const rel of allPaths) {
    if (count >= 120) break;
    const full = path.join(workspaceDir, rel);
    try {
      const stat = fs.statSync(full);
      if (!isSyncableFile(rel, stat.size)) continue;
      result[rel] = fs.readFileSync(full, "utf8");
      count++;
    } catch {
      // Skip unreadable files
    }
  }
  return result;
}

function detectGitHubRemote(workspaceDir: string): {
  owner: string;
  repo: string;
  branch: string;
} | null {
  try {
    const gitConfigPath = path.join(workspaceDir, ".git", "config");
    if (!fs.existsSync(gitConfigPath)) return null;
    const cfg = fs.readFileSync(gitConfigPath, "utf8");
    const remoteMatch = cfg.match(
      /\[remote\s+"origin"\][\s\S]*?url\s*=\s*([^\r\n]+)/i
    );
    if (!remoteMatch) return null;
    const url = remoteMatch[1].trim().replace(/\.git$/i, "");
    const slugMatch = url.match(/github\.com[/:]([^/]+)\/([^/\s]+)/i);
    if (!slugMatch) return null;

    let branch = "main";
    const headPath = path.join(workspaceDir, ".git", "HEAD");
    if (fs.existsSync(headPath)) {
      const head = fs.readFileSync(headPath, "utf8").trim();
      const refMatch = head.match(/^ref:\s*refs\/heads\/(.+)$/);
      if (refMatch) branch = refMatch[1].trim();
    }

    return {
      owner: slugMatch[1],
      repo: slugMatch[2],
      branch,
    };
  } catch {
    return null;
  }
}

export interface TerminalExecResult {
  exitCode: number;
  output: string;
  durationMs: number;
  updatedFiles?: Record<string, string>;
  changedPaths: string[];
  detectedGitHubRepo?: { owner: string; repo: string; branch: string } | null;
}

export async function runProjectTerminalCommand(params: {
  projectId: string;
  command: string;
  files: Record<string, string>;
  githubToken?: string;
  githubLogin?: string;
  gitAuthorName?: string;
  gitAuthorEmail?: string;
}): Promise<TerminalExecResult> {
  const {
    projectId,
    command,
    files,
    githubToken,
    githubLogin,
    gitAuthorName = "Hydrogen AI Studio",
    gitAuthorEmail = "maranie.jaber.tahil@gmail.com",
  } = params;

  const safeId =
    projectId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "default";
  const workspaceDir = path.join(WORKSPACE_ROOT, safeId);

  syncProjectFilesToDisk(workspaceDir, files);

  const startedAt = Date.now();
  const trimmedCmd = command.trim();

  // Virtual handler for interactive GitHub CLI connection commands once user clicked Allow
  if (
    /^(?:gh\s+auth\s+(?:login|status)|github\s+(?:connect|login|auth|status)|connect\s+github)(?:\s|$)/i.test(
      trimmedCmd
    )
  ) {
    if (!githubToken || !githubToken.trim()) {
      return {
        exitCode: 1,
        output:
          "Not authenticated with GitHub. Approve GitHub Access in the chat prompt to connect your account.",
        durationMs: Date.now() - startedAt,
        changedPaths: [],
        detectedGitHubRepo: detectGitHubRemote(workspaceDir),
      };
    }

    const handleLabel = githubLogin ? `@${githubLogin}` : gitAuthorName;
    return {
      exitCode: 0,
      output: [
        "github.com",
        `  ✓ Logged in to github.com as ${handleLabel} (oauth_token)`,
        "  ✓ Git operations protocol: https",
        "  ✓ Token scopes: repo, read:user",
        "  Ready for git clone, git remote, git pull, and git push.",
      ].join("\n"),
      durationMs: Date.now() - startedAt,
      changedPaths: [],
      detectedGitHubRepo: detectGitHubRemote(workspaceDir),
    };
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_AUTHOR_NAME: gitAuthorName,
    GIT_AUTHOR_EMAIL: gitAuthorEmail,
    GIT_COMMITTER_NAME: gitAuthorName,
    GIT_COMMITTER_EMAIL: gitAuthorEmail,
    TERM: "dumb",
  };

  if (githubToken && githubToken.trim()) {
    const basicAuth = Buffer.from(
      `x-access-token:${githubToken.trim()}`
    ).toString("base64");
    env.GIT_CONFIG_COUNT = "1";
    env.GIT_CONFIG_KEY_0 = "http.https://github.com/.extraheader";
    env.GIT_CONFIG_VALUE_0 = `Authorization: Basic ${basicAuth}`;
  }

  const execOutput = await new Promise<{ code: number; text: string }>(
    (resolve) => {
      const child = spawn("bash", ["-c", command], {
        cwd: workspaceDir,
        env,
      });

      let buffer = "";
      let truncated = false;

      const appendChunk = (chunk: Buffer) => {
        if (truncated) return;
        buffer += chunk.toString("utf8");
        if (buffer.length > MAX_OUTPUT_BYTES) {
          buffer = `${buffer.slice(0, MAX_OUTPUT_BYTES)}\n... [output truncated]`;
          truncated = true;
        }
      };

      child.stdout.on("data", appendChunk);
      child.stderr.on("data", appendChunk);

      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        appendChunk(Buffer.from("\n[Command timed out after 45s]"));
      }, EXEC_TIMEOUT_MS);

      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ code: code ?? 1, text: buffer });
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        resolve({ code: 1, text: err.message });
      });
    }
  );

  let cleanedOutput = execOutput.text.trimEnd();
  if (githubToken && githubToken.trim()) {
    cleanedOutput = cleanedOutput.split(githubToken.trim()).join("***");
  }

  if (
    execOutput.code !== 0 &&
    !githubToken &&
    (cleanedOutput.includes("could not read Username") ||
      cleanedOutput.includes("Authentication failed") ||
      cleanedOutput.includes("403"))
  ) {
    cleanedOutput +=
      "\n\nHint: Connect your GitHub Personal Access Token in the Connectors (plug icon) panel so git push can authenticate with GitHub.";
  }

  const afterFiles = readWorkspaceFiles(workspaceDir);
  const changedPaths: string[] = [];

  for (const [k, v] of Object.entries(afterFiles)) {
    if (files[k] !== v) changedPaths.push(k);
  }
  for (const k of Object.keys(files)) {
    if (!(k in afterFiles)) changedPaths.push(k);
  }

  const detectedGitHubRepo = detectGitHubRemote(workspaceDir);

  return {
    exitCode: execOutput.code,
    output: cleanedOutput || "(completed with no output)",
    durationMs: Date.now() - startedAt,
    updatedFiles: changedPaths.length > 0 ? afterFiles : undefined,
    changedPaths,
    detectedGitHubRepo,
  };
}
