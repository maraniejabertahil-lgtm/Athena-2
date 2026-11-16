export interface GitHubUserInfo {
  login: string;
  name?: string;
  avatarUrl?: string;
}

export interface GitHubRepoItem {
  fullName: string;
  defaultBranch: string;
  private: boolean;
  description?: string;
}

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
  ".env.example",
  ".gitignore",
]);

function isAllowedRepoFile(filePath: string, size?: number): boolean {
  if (size !== undefined && size > 150_000) return false;
  const lower = filePath.toLowerCase();
  if (
    lower.startsWith("node_modules/") ||
    lower.startsWith(".git/") ||
    lower.startsWith("dist/") ||
    lower.startsWith("build/") ||
    lower.startsWith(".next/") ||
    lower === "package-lock.json" ||
    lower === "yarn.lock" ||
    lower === "pnpm-lock.yaml"
  ) {
    return false;
  }
  const baseName = lower.split("/").pop() ?? "";
  if (baseName === ".gitignore" || baseName === ".env.example") return true;
  const dotIdx = baseName.lastIndexOf(".");
  if (dotIdx < 0) return false;
  return TEXT_EXTENSIONS.has(baseName.slice(dotIdx));
}

export function parseGitHubRepoSlug(input: string): {
  owner: string;
  repo: string;
} {
  const trimmed = input.trim().replace(/\.git$/i, "").replace(/\/+$/, "");
  const urlMatch = trimmed.match(/github\.com[/:]([^/]+)\/([^/]+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return { owner: parts[0], repo: parts[1] };
  }
  throw new Error(
    'Enter a valid GitHub repository such as "owner/repo" or "https://github.com/owner/repo".'
  );
}

function ghHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "hydrogen-ai-studio",
  };
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

export async function fetchGitHubUser(token: string): Promise<GitHubUserInfo> {
  const res = await fetch("https://api.github.com/user", {
    headers: ghHeaders(token),
  });
  if (!res.ok) {
    throw new Error("Invalid or expired GitHub token.");
  }
  const data = (await res.json()) as {
    login: string;
    name?: string;
    avatar_url?: string;
  };
  return {
    login: data.login,
    name: data.name,
    avatarUrl: data.avatar_url,
  };
}

export async function fetchGitHubRepos(token: string): Promise<GitHubRepoItem[]> {
  const res = await fetch(
    "https://api.github.com/user/repos?sort=updated&per_page=40",
    { headers: ghHeaders(token) }
  );
  if (!res.ok) {
    throw new Error("Failed to fetch repositories from GitHub.");
  }
  const list = (await res.json()) as Array<{
    full_name: string;
    default_branch: string;
    private: boolean;
    description?: string | null;
  }>;
  return list.map((r) => ({
    fullName: r.full_name,
    defaultBranch: r.default_branch || "main",
    private: Boolean(r.private),
    description: r.description ?? undefined,
  }));
}

export async function importGitHubRepoFiles(params: {
  repoInput: string;
  branch?: string;
  token?: string;
}): Promise<{
  owner: string;
  repo: string;
  branch: string;
  files: Record<string, string>;
}> {
  const { owner, repo } = parseGitHubRepoSlug(params.repoInput);
  const headers = ghHeaders(params.token);

  const metaRes = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { headers }
  );
  if (!metaRes.ok) {
    const errText =
      metaRes.status === 404
        ? `Repository "${owner}/${repo}" was not found (connect a GitHub token if it is private).`
        : `GitHub API error (${metaRes.status}) while loading repository.`;
    throw new Error(errText);
  }
  const meta = (await metaRes.json()) as { default_branch?: string };
  const branch = params.branch?.trim() || meta.default_branch || "main";

  const treeRes = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { headers }
  );
  if (!treeRes.ok) {
    throw new Error(`Could not load file tree for branch "${branch}".`);
  }

  const treeData = (await treeRes.json()) as {
    tree?: Array<{ path: string; type: string; sha: string; size?: number }>;
  };

  const candidates = (treeData.tree ?? [])
    .filter((item) => item.type === "blob" && isAllowedRepoFile(item.path, item.size))
    .slice(0, 60);

  if (candidates.length === 0) {
    throw new Error("No supported source files were found in this repository.");
  }

  const files: Record<string, string> = {};
  const BATCH_SIZE = 10;

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (entry) => {
        const blobRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${entry.sha}`,
          { headers }
        );
        if (!blobRes.ok) return;
        const blobData = (await blobRes.json()) as {
          content?: string;
          encoding?: string;
        };
        if (blobData.encoding === "base64" && blobData.content) {
          files[entry.path] = Buffer.from(
            blobData.content.replace(/\n/g, ""),
            "base64"
          ).toString("utf8");
        }
      })
    );
  }

  return { owner, repo, branch, files };
}

export async function pushProjectToGitHub(params: {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  message: string;
  files: Record<string, string>;
}): Promise<{ commitSha: string; commitUrl: string }> {
  const { token, owner, repo, branch, message, files } = params;
  const headers = {
    ...ghHeaders(token),
    "Content-Type": "application/json",
  };

  const baseUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const refRes = await fetch(
    `${baseUrl}/git/ref/heads/${encodeURIComponent(branch)}`,
    { headers }
  );
  if (!refRes.ok) {
    throw new Error(
      `Branch "${branch}" not found on ${owner}/${repo} (check token repo permissions).`
    );
  }
  const refData = (await refRes.json()) as { object: { sha: string } };
  const parentCommitSha = refData.object.sha;

  const commitRes = await fetch(`${baseUrl}/git/commits/${parentCommitSha}`, {
    headers,
  });
  if (!commitRes.ok) {
    throw new Error("Failed to read latest commit on target branch.");
  }
  const commitData = (await commitRes.json()) as { tree: { sha: string } };
  const baseTreeSha = commitData.tree.sha;

  const fileEntries = Object.entries(files).filter(
    ([filePath]) => !filePath.startsWith(".git/")
  );

  const treeItems: Array<{
    path: string;
    mode: string;
    type: string;
    sha: string;
  }> = [];

  for (const [filePath, content] of fileEntries) {
    const blobRes = await fetch(`${baseUrl}/git/blobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        content,
        encoding: "utf-8",
      }),
    });
    if (!blobRes.ok) {
      throw new Error(`Failed to upload "${filePath}" to GitHub.`);
    }
    const blobJson = (await blobRes.json()) as { sha: string };
    treeItems.push({
      path: filePath.replace(/^\/+/, ""),
      mode: "100644",
      type: "blob",
      sha: blobJson.sha,
    });
  }

  const newTreeRes = await fetch(`${baseUrl}/git/trees`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeItems,
    }),
  });
  if (!newTreeRes.ok) {
    throw new Error("Failed to create GitHub commit tree.");
  }
  const newTreeJson = (await newTreeRes.json()) as { sha: string };

  const newCommitRes = await fetch(`${baseUrl}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: message.trim() || "Update project from Hydrogen AI Studio",
      tree: newTreeJson.sha,
      parents: [parentCommitSha],
    }),
  });
  if (!newCommitRes.ok) {
    throw new Error("Failed to create GitHub commit.");
  }
  const newCommitJson = (await newCommitRes.json()) as {
    sha: string;
    html_url?: string;
  };

  const updateRefRes = await fetch(
    `${baseUrl}/git/refs/heads/${encodeURIComponent(branch)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        sha: newCommitJson.sha,
        force: false,
      }),
    }
  );
  if (!updateRefRes.ok) {
    throw new Error("Failed to update branch ref on GitHub.");
  }

  return {
    commitSha: newCommitJson.sha,
    commitUrl:
      newCommitJson.html_url ||
      `https://github.com/${owner}/${repo}/commit/${newCommitJson.sha}`,
  };
}
