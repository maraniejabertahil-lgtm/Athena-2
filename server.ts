import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { bundleProjectFiles } from "./src/server/bundler.ts";
import {
  formatGeminiError,
  runStudioAssist,
  runStudioAssistStream,
  type AssistAttachment,
  type AssistHistoryMessage,
} from "./src/server/gemini.ts";
import {
  fetchGitHubRepos,
  fetchGitHubUser,
  importGitHubRepoFiles,
  pushProjectToGitHub,
} from "./src/server/github.ts";
import { runProjectTerminalCommand } from "./src/server/terminal.ts";
import {
  addKnowledgeFile,
  listKnowledgeFiles,
  removeKnowledgeFile,
} from "./src/server/knowledge.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

const previewHtmlCache = new Map<string, string>();

function getAppBaseUrl(req: express.Request): string {
  if (process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL") {
    return process.env.APP_URL.replace(/\/+$/, "");
  }
  const proto =
    (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "35mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, hasKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  // --- Preview Bundler Routes ---
  app.post("/api/preview/bundle", async (req, res) => {
    try {
      const { projectId = "default", files = {} } = req.body as {
        projectId?: string;
        files?: Record<string, string>;
      };

      const result = await bundleProjectFiles(files);
      previewHtmlCache.set(projectId, result.html);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        html: "",
        diagnostics: [
          {
            id: "bundler-crash",
            severity: "error",
            message:
              error instanceof Error ? error.message : "Failed to bundle project.",
          },
        ],
        durationMs: 0,
        bundleSizeBytes: 0,
      });
    }
  });

  app.get("/api/preview/page/:projectId", (req, res) => {
    const html = previewHtmlCache.get(req.params.projectId);
    if (!html) {
      res
        .status(404)
        .send(
          "<html><body style='font-family:sans-serif;background:#111318;color:#f5f5f5;padding:32px'>Preview not bundled yet. Open Preview mode in AI Studio first.</body></html>"
        );
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  // --- GitHub Connector & OAuth Routes ---
  app.get("/api/github/oauth/config", (req, res) => {
    const configured = Boolean(
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    );
    const callbackUrl = `${getAppBaseUrl(req)}/auth/github/callback`;
    res.json({ configured, callbackUrl });
  });

  app.get("/api/github/oauth/url", (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId || !process.env.GITHUB_CLIENT_SECRET) {
      res.status(400).json({
        error:
          "GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are not set. You can connect directly using a GitHub Personal Access Token below.",
      });
      return;
    }
    const redirectUri = `${getAppBaseUrl(req)}/auth/github/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "repo read:user",
    });
    res.json({
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    });
  });

  const handleGitHubCallback = async (
    req: express.Request,
    res: express.Response
  ) => {
    const code = String(req.query.code ?? "");
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!code || !clientId || !clientSecret) {
      res.status(400).send("Missing OAuth code or GitHub OAuth configuration.");
      return;
    }

    try {
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: `${getAppBaseUrl(req)}/auth/github/callback`,
        }),
      });
      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        error_description?: string;
      };

      if (!tokenData.access_token) {
        res
          .status(400)
          .send(tokenData.error_description || "Failed to obtain GitHub token.");
        return;
      }

      const user = await fetchGitHubUser(tokenData.access_token);
      res.send(`<!doctype html>
<html>
  <body style="font-family:sans-serif;background:#111318;color:#f5f5f5;padding:24px;">
    <script>
      if (window.opener) {
        window.opener.postMessage({
          type: 'GITHUB_OAUTH_SUCCESS',
          token: ${JSON.stringify(tokenData.access_token)},
          user: ${JSON.stringify(user)}
        }, '*');
        window.close();
      }
    </script>
    <p>Connected to GitHub as ${user.login}. You may close this window.</p>
  </body>
</html>`);
    } catch (err) {
      res
        .status(500)
        .send(err instanceof Error ? err.message : "GitHub OAuth failed.");
    }
  };

  app.get(
    ["/auth/github/callback", "/auth/github/callback/"],
    handleGitHubCallback
  );

  app.post("/api/github/verify", async (req, res) => {
    try {
      const { token } = req.body as { token?: string };
      if (!token || !token.trim()) {
        res.status(400).json({ error: "GitHub token is required." });
        return;
      }
      const user = await fetchGitHubUser(token);
      const repos = await fetchGitHubRepos(token);
      res.json({ user, repos });
    } catch (err) {
      res.status(401).json({
        error: err instanceof Error ? err.message : "GitHub connection failed.",
      });
    }
  });

  app.post("/api/github/repos", async (req, res) => {
    try {
      const { token } = req.body as { token?: string };
      if (!token) {
        res.status(400).json({ error: "GitHub token is required." });
        return;
      }
      const repos = await fetchGitHubRepos(token);
      res.json({ repos });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Failed to load repositories.",
      });
    }
  });

  app.post("/api/github/import", async (req, res) => {
    try {
      const { repoInput, branch, token } = req.body as {
        repoInput?: string;
        branch?: string;
        token?: string;
      };
      if (!repoInput || !repoInput.trim()) {
        res.status(400).json({ error: "Repository name or URL is required." });
        return;
      }
      const imported = await importGitHubRepoFiles({
        repoInput,
        branch,
        token,
      });
      res.json(imported);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "GitHub import failed.",
      });
    }
  });

  app.post("/api/github/push", async (req, res) => {
    try {
      const { token, owner, repo, branch, message, files } = req.body as {
        token?: string;
        owner?: string;
        repo?: string;
        branch?: string;
        message?: string;
        files?: Record<string, string>;
      };

      if (!token || !owner || !repo || !branch || !files) {
        res.status(400).json({
          error: "Connected GitHub token, repository, branch, and files are required.",
        });
        return;
      }

      const result = await pushProjectToGitHub({
        token,
        owner,
        repo,
        branch,
        message: message || "Update project from Hydrogen AI Studio",
        files,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "GitHub push failed.",
      });
    }
  });

  // --- Custom API Connector Test Proxy ---
  app.post("/api/connectors/test", async (req, res) => {
    try {
      const { url, method = "GET", authHeader } = req.body as {
        url?: string;
        method?: "GET" | "POST";
        authHeader?: string;
      };
      if (!url || !/^https?:\/\//i.test(url)) {
        res.status(400).json({ error: "Enter a valid http(s) endpoint URL." });
        return;
      }
      const headers: Record<string, string> = {
        Accept: "application/json, text/plain, */*",
      };
      if (authHeader && authHeader.trim()) {
        headers.Authorization = authHeader.trim();
      }
      const upstream = await fetch(url, { method, headers });
      const text = await upstream.text();
      res.json({
        status: upstream.status,
        ok: upstream.ok,
        preview: text.slice(0, 2000),
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : "Connector request failed.",
      });
    }
  });

  // --- Project Terminal Execution Route ---
  app.post("/api/terminal/exec", async (req, res) => {
    try {
      const {
        projectId = "default",
        command = "",
        files = {},
        githubToken,
        githubLogin,
        gitAuthorName,
        gitAuthorEmail,
      } = req.body as {
        projectId?: string;
        command?: string;
        files?: Record<string, string>;
        githubToken?: string;
        githubLogin?: string;
        gitAuthorName?: string;
        gitAuthorEmail?: string;
      };

      if (!command.trim()) {
        res.status(400).json({ error: "Enter a terminal command to run." });
        return;
      }

      const result = await runProjectTerminalCommand({
        projectId,
        command,
        files,
        githubToken,
        githubLogin,
        gitAuthorName,
        gitAuthorEmail,
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error ? err.message : "Terminal execution failed.",
      });
    }
  });

  // --- Project Knowledge Library ---
  app.get("/api/knowledge/:projectId", (req, res) => {
    res.json({ files: listKnowledgeFiles(req.params.projectId) });
  });

  app.post("/api/knowledge/:projectId", (req, res) => {
    try {
      const { name = "", content = "", encoding = "text" } = req.body as {
        name?: string;
        content?: string;
        encoding?: "text" | "base64";
      };
      if (!content) {
        res.status(400).json({ error: "File content is empty." });
        return;
      }
      const info = addKnowledgeFile(req.params.projectId, name, content, encoding);
      res.json({ id: info.id, name: info.name, chunks: info.chunks.length });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed." });
    }
  });

  app.delete("/api/knowledge/:projectId/:fileId", (req, res) => {
    const removed = removeKnowledgeFile(req.params.projectId, req.params.fileId);
    res.status(removed ? 200 : 404).json({ removed });
  });

  // --- AI Project Assistant Route ---
  app.post("/api/studio/assist", async (req, res) => {
    try {
      const {
        projectId = "default",
        model = "gemini-4-hydrogen",
        prompt = "",
        files = {},
        activeFile,
        history = [],
        attachments = [],
        systemInstruction,
        thinkingLevel = "LOW",
        useSearch = false,
        useUrlContext = false,
        activePlugins = [],
        activeSkills = [],
        activeApiConnectors = [],
        githubRepo = null,
        fallbackOnQuota = true,
      } = req.body as {
        projectId?: string;
        model?: string;
        prompt?: string;
        files?: Record<string, string>;
        activeFile?: string;
        history?: AssistHistoryMessage[];
        attachments?: AssistAttachment[];
        systemInstruction?: string;
        thinkingLevel?: string;
        useSearch?: boolean;
        useUrlContext?: boolean;
        activePlugins?: Array<{ name: string; instruction: string }>;
        activeSkills?: Array<{ name: string; instructions: string }>;
        activeApiConnectors?: Array<{
          name: string;
          url: string;
          method: string;
          lastResponsePreview?: string;
        }>;
        githubRepo?: { owner: string; repo: string; branch: string } | null;
        fallbackOnQuota?: boolean;
      };

      if (!prompt.trim() && attachments.length === 0) {
        res.status(400).json({ error: "Please enter a prompt or attach a file." });
        return;
      }

      const result = await runStudioAssist({
        projectId,
        model,
        prompt,
        files,
        activeFile,
        history,
        attachments,
        systemInstruction,
        thinkingLevel,
        useSearch,
        useUrlContext,
        activePlugins,
        activeSkills,
        activeApiConnectors,
        githubRepo,
        fallbackOnQuota,
      });

      res.json(result);
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post("/api/studio/assist/stream", async (req, res) => {
    const {
      projectId = "default",
      model = "gemini-4-hydrogen",
      prompt = "",
      files = {},
      activeFile,
      history = [],
      attachments = [],
      systemInstruction,
      thinkingLevel = "LOW",
      useSearch = false,
      useUrlContext = false,
      activePlugins = [],
      activeSkills = [],
      activeApiConnectors = [],
      githubRepo = null,
      fallbackOnQuota = true,
    } = req.body as {
      projectId?: string;
      model?: string;
      prompt?: string;
      files?: Record<string, string>;
      activeFile?: string;
      history?: AssistHistoryMessage[];
      attachments?: AssistAttachment[];
      systemInstruction?: string;
      thinkingLevel?: string;
      useSearch?: boolean;
      useUrlContext?: boolean;
      activePlugins?: Array<{ name: string; instruction: string }>;
      activeSkills?: Array<{ name: string; instructions: string }>;
      activeApiConnectors?: Array<{
        name: string;
        url: string;
        method: string;
        lastResponsePreview?: string;
      }>;
      githubRepo?: { owner: string; repo: string; branch: string } | null;
      fallbackOnQuota?: boolean;
    };

    if (!prompt.trim() && attachments.length === 0) {
      res.status(400).json({ error: "Please enter a prompt or attach a file." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const abortController = new AbortController();
    let streamFinished = false;
    res.on("close", () => {
      if (!streamFinished) {
        abortController.abort();
      }
    });

    const sendEvent = (payload: Record<string, unknown>) => {
      if (res.writableEnded) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const result = await runStudioAssistStream(
        {
          projectId,
          model,
          prompt,
          files,
          activeFile,
          history,
          attachments,
          systemInstruction,
          thinkingLevel,
          useSearch,
          useUrlContext,
          activePlugins,
          activeSkills,
          activeApiConnectors,
          githubRepo,
          fallbackOnQuota,
        },
        {
          signal: abortController.signal,
          onStatus: (status) => sendEvent({ type: "status", status }),
          onThoughts: (thoughts) => sendEvent({ type: "thoughts", thoughts }),
          onContent: (content) => sendEvent({ type: "content", content }),
          onStep: (step) => sendEvent({ type: "step", step }),
        }
      );

      streamFinished = true;
      sendEvent({ type: "done", result });
      res.end();
    } catch (error) {
      streamFinished = true;
      if (!abortController.signal.aborted) {
        const formatted = formatGeminiError(error);
        sendEvent({ type: "error", error: formatted.message });
      }
      if (!res.writableEnded) res.end();
    }
  });

  const isProd = process.env.NODE_ENV === "production";
  const distPath = path.resolve(__dirname, "dist");

  if (!isProd || !fs.existsSync(distPath)) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Hydrogen Studio running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start Hydrogen Studio server:", err);
  process.exit(1);
});
