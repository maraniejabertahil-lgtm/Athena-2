import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { Code2, Columns2, Eye, MessageSquare, PanelLeft } from "lucide-react";
import { AssistantPanel } from "./components/AssistantPanel.tsx";
import { CodeWorkspace } from "./components/CodeWorkspace.tsx";
import {
  ProjectsModal,
  SettingsModal,
  ShareModal,
  VersionsModal,
} from "./components/ModalsAndDrawers.tsx";
import { PreviewWorkspace } from "./components/PreviewWorkspace.tsx";
import { TopToolbar } from "./components/TopToolbar.tsx";
import {
  createNewProject,
  DEFAULT_PLUGINS,
  DEFAULT_SKILLS,
  STUDIO_MODELS,
} from "./data/defaultProject.ts";
import {
  AgentStep,
  ApiConnector,
  AssistantMessage,
  AttachmentItem,
  BuildLogEntry,
  BundleDiagnostic,
  ConsoleEntry,
  FileOperation,
  GitHubAuthRequest,
  GitHubRepoSummary,
  GitHubUser,
  GroundingSource,
  ProjectVersion,
  StudioModelId,
  StudioPlugin,
  StudioProject,
  StudioSkill,
  WorkspaceViewMode,
} from "./types/studio.ts";

const STORAGE_PROJECTS_KEY = "hydrogen_ai_studio_projects_v2";
const STORAGE_ACTIVE_ID_KEY = "hydrogen_ai_studio_active_project_v2";
const STORAGE_THEME_KEY = "hydrogen_ai_studio_theme_v2";
const STORAGE_CUSTOM_PLUGINS_KEY = "hydrogen_ai_studio_custom_plugins_v1";
const STORAGE_CUSTOM_SKILLS_KEY = "hydrogen_ai_studio_custom_skills_v1";
const STORAGE_API_CONNECTORS_KEY = "hydrogen_ai_studio_api_connectors_v1";
const STORAGE_GH_TOKEN_KEY = "hydrogen_ai_studio_gh_token_v1";
const STORAGE_GH_USER_KEY = "hydrogen_ai_studio_gh_user_v1";
const STORAGE_DEFAULT_MODEL_KEY = "hydrogen_ai_studio_default_model_v1";

function getPreferredDefaultModel(): StudioModelId {
  try {
    const saved = localStorage.getItem(STORAGE_DEFAULT_MODEL_KEY);
    if (saved && STUDIO_MODELS.some((m) => m.id === saved)) {
      return saved as StudioModelId;
    }
  } catch {
    // Ignore storage error
  }
  return "gemini-4-hydrogen";
}

function normalizeProject(raw: StudioProject): StudioProject {
  return {
    ...raw,
    useUrlContext: Boolean(raw.useUrlContext),
    fallbackOnQuota: raw.fallbackOnQuota ?? true,
    enabledPluginIds: Array.isArray(raw.enabledPluginIds)
      ? raw.enabledPluginIds
      : ["responsive-guard", "code-hygiene"],
    enabledSkillIds: Array.isArray(raw.enabledSkillIds)
      ? raw.enabledSkillIds
      : ["ui-ux-designer"],
    githubRepo: raw.githubRepo ?? null,
  };
}

function applyOperationsToFiles(
  currentFiles: Record<string, string>,
  operations: FileOperation[]
): Record<string, string> {
  const next = { ...currentFiles };
  for (const op of operations) {
    const cleanPath = op.path.replace(/^\/+/, "");
    if (!cleanPath) continue;
    if (op.action === "delete") {
      delete next[cleanPath];
    } else {
      next[cleanPath] = op.content ?? "";
    }
  }
  return next;
}

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      return localStorage.getItem(STORAGE_THEME_KEY) === "light"
        ? "light"
        : "dark";
    } catch {
      return "dark";
    }
  });

  const [projects, setProjects] = useState<StudioProject[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PROJECTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StudioProject[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizeProject);
        }
      }
    } catch {
      // Fallback
    }
    const fresh = createNewProject("my-project");
    const preferredModel = getPreferredDefaultModel();
    const def =
      STUDIO_MODELS.find((m) => m.id === preferredModel) ?? STUDIO_MODELS[0];
    return [
      {
        ...fresh,
        model: preferredModel,
        thinkingLevel: def.defaultThinkingLevel,
      },
    ];
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_ACTIVE_ID_KEY);
      if (savedId) return savedId;
    } catch {
      // Ignore
    }
    return projects[0]?.id ?? "";
  });

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? projects[0],
    [projects, activeProjectId]
  );

  // Layout & Panels
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>("split");
  const [mobileSection, setMobileSection] = useState<
    "chat" | "split" | "workspace"
  >("split");
  const [leftWidthPct, setLeftWidthPct] = useState(28);
  const [splitCodePct, setSplitCodePct] = useState(50);

  // Undo / Redo Stacks per session
  const [undoStack, setUndoStack] = useState<Record<string, string>[]>([]);
  const [redoStack, setRedoStack] = useState<Record<string, string>[]>([]);

  // Live Preview & Diagnostics
  const [bundledHtml, setBundledHtml] = useState("");
  const [isBundling, setIsBundling] = useState(false);
  const [previewKey, setPreviewKey] = useState(1);
  const [diagnostics, setDiagnostics] = useState<BundleDiagnostic[]>([]);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [runtimeErrors, setRuntimeErrors] = useState<ConsoleEntry[]>([]);
  const [buildLogs, setBuildLogs] = useState<BuildLogEntry[]>([]);

  // AI Assistant state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunningTerminal, setIsRunningTerminal] = useState(false);
  const [externalDraftPrompt, setExternalDraftPrompt] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  // Save status & Modals
  const [saveLabel, setSaveLabel] = useState("Saved");
  const [modal, setModal] = useState<
    "projects" | "versions" | "share" | "settings" | null
  >(null);

  // Plugins, Skills & Connectors state
  const [customPlugins, setCustomPlugins] = useState<StudioPlugin[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CUSTOM_PLUGINS_KEY);
      return raw ? (JSON.parse(raw) as StudioPlugin[]) : [];
    } catch {
      return [];
    }
  });
  const [customSkills, setCustomSkills] = useState<StudioSkill[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CUSTOM_SKILLS_KEY);
      return raw ? (JSON.parse(raw) as StudioSkill[]) : [];
    } catch {
      return [];
    }
  });
  const [apiConnectors, setApiConnectors] = useState<ApiConnector[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_API_CONNECTORS_KEY);
      return raw ? (JSON.parse(raw) as ApiConnector[]) : [];
    } catch {
      return [];
    }
  });
  const [githubToken, setGithubToken] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_GH_TOKEN_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_GH_USER_KEY);
      return raw ? (JSON.parse(raw) as GitHubUser) : null;
    } catch {
      return null;
    }
  });
  const [githubRepos, setGithubRepos] = useState<GitHubRepoSummary[]>([]);

  const allPlugins = useMemo(
    () => [...DEFAULT_PLUGINS, ...customPlugins],
    [customPlugins]
  );
  const allSkills = useMemo(
    () => [...DEFAULT_SKILLS, ...customSkills],
    [customSkills]
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rightAreaRef = useRef<HTMLDivElement | null>(null);
  const dragTargetRef = useRef<"left" | "split" | null>(null);

  // Sync dark/light class
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
    } catch {
      // Ignore
    }
  }, [theme]);

  // Auto-save projects to localStorage
  useEffect(() => {
    setSaveLabel("Saving...");
    const timer = setTimeout(() => {
      try {
        const sanitized = projects.map((p) => ({
          ...p,
          conversations: p.conversations.map((c) => ({
            ...c,
            messages: c.messages.map((m) => ({
              ...m,
              attachments: m.attachments?.map((a) => ({
                ...a,
                dataBase64: a.sizeBytes > 200_000 ? "" : a.dataBase64,
                previewUrl: a.sizeBytes > 200_000 ? undefined : a.previewUrl,
              })),
            })),
          })),
        }));
        localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(sanitized));
        localStorage.setItem(STORAGE_ACTIVE_ID_KEY, activeProject?.id ?? "");
        setSaveLabel(
          `Saved · ${new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}`
        );
      } catch {
        setSaveLabel("Saved locally");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [projects, activeProject?.id]);

  // Listen to preview iframe console/runtime errors
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        source?: string;
        type?: "console" | "runtime-error";
        level?: "log" | "info" | "warn" | "error";
        message?: string;
      };
      if (data?.source !== "hydrogen-preview" || !data.message) return;

      if (data.type === "console") {
        setConsoleEntries((prev) => [
          ...prev.slice(-99),
          {
            id: crypto.randomUUID(),
            level: data.level ?? "log",
            message: data.message!,
            timestamp: Date.now(),
          },
        ]);
      } else if (data.type === "runtime-error") {
        setRuntimeErrors((prev) => [
          ...prev.slice(-49),
          {
            id: crypto.randomUUID(),
            level: "error",
            message: data.message!,
            timestamp: Date.now(),
          },
        ]);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Persist extensions & GitHub credentials
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_CUSTOM_PLUGINS_KEY,
        JSON.stringify(customPlugins)
      );
      localStorage.setItem(
        STORAGE_CUSTOM_SKILLS_KEY,
        JSON.stringify(customSkills)
      );
      localStorage.setItem(
        STORAGE_API_CONNECTORS_KEY,
        JSON.stringify(apiConnectors)
      );
      localStorage.setItem(STORAGE_GH_TOKEN_KEY, githubToken);
      if (githubUser) {
        localStorage.setItem(STORAGE_GH_USER_KEY, JSON.stringify(githubUser));
      } else {
        localStorage.removeItem(STORAGE_GH_USER_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [customPlugins, customSkills, apiConnectors, githubToken, githubUser]);

  // Hydrate GitHub repos if token is saved
  useEffect(() => {
    if (!githubToken) {
      setGithubRepos([]);
      return;
    }
    fetch("/api/github/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: githubToken }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { repos?: GitHubRepoSummary[] } | null) => {
        if (data?.repos) setGithubRepos(data.repos);
      })
      .catch(() => {});
  }, [githubToken]);

  // Listen for GitHub OAuth popup completion
  useEffect(() => {
    const onOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      const isTrusted =
        origin === window.location.origin ||
        origin.endsWith(".run.app") ||
        origin.startsWith("http://localhost");
      if (!isTrusted) return;

      const payload = event.data as {
        type?: string;
        token?: string;
        user?: GitHubUser;
      };
      if (payload?.type === "GITHUB_OAUTH_SUCCESS" && payload.token) {
        setGithubToken(payload.token);
        if (payload.user) setGithubUser(payload.user);
      }
    };
    window.addEventListener("message", onOAuthMessage);
    return () => window.removeEventListener("message", onOAuthMessage);
  }, []);

  // Live project bundler
  const runBundle = useCallback(
    async (projectId: string, files: Record<string, string>) => {
      setIsBundling(true);
      try {
        const res = await fetch("/api/preview/bundle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, files }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          html: string;
          diagnostics: BundleDiagnostic[];
          durationMs: number;
          bundleSizeBytes: number;
        };
        setBundledHtml(data.html ?? "");
        setDiagnostics(data.diagnostics ?? []);
        setRuntimeErrors([]);
        setBuildLogs((prev) => [
          {
            id: crypto.randomUUID(),
            status: data.ok ? "success" : "error",
            durationMs: data.durationMs,
            message: data.ok
              ? `Build succeeded in ${data.durationMs}ms (${(
                  data.bundleSizeBytes / 1024
                ).toFixed(1)} KB)`
              : `Build failed with ${data.diagnostics?.length ?? 1} error(s)`,
            timestamp: Date.now(),
          },
          ...prev.slice(0, 39),
        ]);
      } catch (err) {
        setBuildLogs((prev) => [
          {
            id: crypto.randomUUID(),
            status: "error",
            message:
              err instanceof Error ? err.message : "Bundler request failed",
            timestamp: Date.now(),
          },
          ...prev.slice(0, 39),
        ]);
      } finally {
        setIsBundling(false);
      }
    },
    []
  );

  // Debounced auto-bundle whenever project files change
  useEffect(() => {
    if (!activeProject) return;
    const timer = setTimeout(() => {
      runBundle(activeProject.id, activeProject.files);
    }, 280);
    return () => clearTimeout(timer);
  }, [activeProject?.id, activeProject?.files, runBundle]);

  // Resizable Drag Handlers
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragTargetRef.current) return;
      if (dragTargetRef.current === "left" && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const pct = ((e.clientX - rect.left) / rect.width) * 100;
        setLeftWidthPct(Math.min(45, Math.max(20, pct)));
      } else if (dragTargetRef.current === "split" && rightAreaRef.current) {
        const rect = rightAreaRef.current.getBoundingClientRect();
        const pct = ((e.clientX - rect.left) / rect.width) * 100;
        setSplitCodePct(Math.min(75, Math.max(25, pct)));
      }
    };

    const onMouseUp = () => {
      dragTargetRef.current = null;
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const updateActiveProject = useCallback(
    (updater: (prev: StudioProject) => StudioProject) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeProject.id
            ? { ...updater(p), updatedAt: Date.now() }
            : p
        )
      );
    },
    [activeProject?.id]
  );

  const pushFilesWithUndo = useCallback(
    (nextFiles: Record<string, string>, label?: string) => {
      if (!activeProject) return;
      setUndoStack((prev) => [...prev.slice(-29), activeProject.files]);
      setRedoStack([]);
      updateActiveProject((proj) => {
        const openTabs = proj.openTabs.filter((t) => t in nextFiles);
        const activeFile =
          proj.activeFile in nextFiles
            ? proj.activeFile
            : openTabs[0] || Object.keys(nextFiles)[0] || "";

        const nextVersions = label
          ? [
              {
                id: crypto.randomUUID(),
                label,
                createdAt: Date.now(),
                files: { ...nextFiles },
                changedFilesCount: Object.keys(nextFiles).length,
              },
              ...proj.versions.slice(0, 24),
            ]
          : proj.versions;

        return {
          ...proj,
          files: nextFiles,
          openTabs:
            openTabs.length > 0 ? openTabs : activeFile ? [activeFile] : [],
          activeFile,
          versions: nextVersions,
        };
      });
    },
    [activeProject, updateActiveProject]
  );

  const handleUndo = () => {
    if (undoStack.length === 0 || !activeProject) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, activeProject.files]);
    updateActiveProject((p) => ({ ...p, files: previous }));
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !activeProject) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, activeProject.files]);
    updateActiveProject((p) => ({ ...p, files: next }));
  };

  // File Explorer & Editor Handlers
  const handleSelectFile = (filePath: string) => {
    updateActiveProject((p) => ({
      ...p,
      activeFile: filePath,
      openTabs: p.openTabs.includes(filePath)
        ? p.openTabs
        : [...p.openTabs, filePath],
    }));
    if (viewMode === "preview") {
      setViewMode("split");
    }
  };

  const handleCloseTab = (filePath: string) => {
    updateActiveProject((p) => {
      const remaining = p.openTabs.filter((t) => t !== filePath);
      const nextActive =
        p.activeFile === filePath
          ? remaining[remaining.length - 1] ?? ""
          : p.activeFile;
      return { ...p, openTabs: remaining, activeFile: nextActive };
    });
  };

  const handleUpdateFileContent = (filePath: string, content: string) => {
    updateActiveProject((p) => ({
      ...p,
      files: { ...p.files, [filePath]: content },
    }));
  };

  const handleCreateFile = (filePath: string) => {
    const clean = filePath.replace(/^\/+/, "");
    if (!clean) return;
    const nextFiles = {
      ...activeProject.files,
      [clean]: activeProject.files[clean] ?? "",
    };
    pushFilesWithUndo(nextFiles);
    handleSelectFile(clean);
  };

  const handleRenameFile = (oldPath: string, newPath: string) => {
    const cleanNew = newPath.replace(/^\/+/, "");
    if (!cleanNew || cleanNew === oldPath) return;
    const nextFiles = { ...activeProject.files };
    nextFiles[cleanNew] = nextFiles[oldPath] ?? "";
    delete nextFiles[oldPath];
    pushFilesWithUndo(nextFiles);
    updateActiveProject((p) => ({
      ...p,
      openTabs: p.openTabs.map((t) => (t === oldPath ? cleanNew : t)),
      activeFile: p.activeFile === oldPath ? cleanNew : p.activeFile,
    }));
  };

  const handleDeleteFile = (filePath: string) => {
    const nextFiles = { ...activeProject.files };
    delete nextFiles[filePath];
    pushFilesWithUndo(nextFiles);
  };

  // AI Assistant Handlers
  const handleSendPrompt = async (
    prompt: string,
    attachments: AttachmentItem[],
    options?: { baseMessages?: AssistantMessage[] }
  ) => {
    if (!activeProject || isGenerating) return;

    const convId = activeProject.activeConversationId;
    const activeConv =
      activeProject.conversations.find((c) => c.id === convId) ??
      activeProject.conversations[0];
    const baseMsgs = options?.baseMessages ?? activeConv?.messages ?? [];

    const userMsg: AssistantMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: Date.now(),
    };

    const isFirstMsg = baseMsgs.length === 0;
    const autoConvTitle = isFirstMsg
      ? (prompt || attachments[0]?.name || "Chat").slice(0, 42)
      : undefined;

    updateActiveProject((proj) => ({
      ...proj,
      conversations: proj.conversations.map((c) =>
        c.id === activeConv.id
          ? {
              ...c,
              title: autoConvTitle ?? c.title,
              messages: [...baseMsgs, userMsg],
              updatedAt: Date.now(),
            }
          : c
      ),
    }));

    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true);

    try {
      const enabledPluginsPayload = allPlugins
        .filter((pl) => activeProject.enabledPluginIds.includes(pl.id))
        .map((pl) => ({ name: pl.name, instruction: pl.instruction }));
      const enabledSkillsPayload = allSkills
        .filter((sk) => activeProject.enabledSkillIds.includes(sk.id))
        .map((sk) => ({ name: sk.name, instructions: sk.instructions }));
      const enabledConnectorsPayload = apiConnectors
        .filter((c) => c.enabled)
        .map((c) => ({
          name: c.name,
          url: c.url,
          method: c.method,
          lastResponsePreview: c.lastResponsePreview,
        }));

      const streamingMsgId = crypto.randomUUID();
      const initialAssistantMsg: AssistantMessage = {
        id: streamingMsgId,
        role: "assistant",
        content: "",
        thoughts: "",
        streamingStatus: "Connecting...",
        modelUsed: activeProject.model,
        createdAt: Date.now(),
      };

      updateActiveProject((proj) => ({
        ...proj,
        conversations: proj.conversations.map((c) =>
          c.id === activeConv.id
            ? {
                ...c,
                messages: [...c.messages, initialAssistantMsg],
                updatedAt: Date.now(),
              }
            : c
        ),
      }));

      const patchStreamingMsg = (patch: Partial<AssistantMessage>) => {
        updateActiveProject((proj) => ({
          ...proj,
          conversations: proj.conversations.map((c) =>
            c.id === activeConv.id
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === streamingMsgId ? { ...m, ...patch } : m
                  ),
                  updatedAt: Date.now(),
                }
              : c
          ),
        }));
      };

      const res = await fetch("/api/studio/assist/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          projectId: activeProject.id,
          model: activeProject.model,
          prompt,
          files: activeProject.files,
          activeFile: activeProject.activeFile,
          history: baseMsgs,
          attachments: attachments.map((a) => ({
            name: a.name,
            mimeType: a.mimeType,
            dataBase64: a.dataBase64,
          })),
          systemInstruction: activeProject.systemInstruction,
          thinkingLevel: activeProject.thinkingLevel,
          useSearch: activeProject.useSearch,
          useUrlContext: activeProject.useUrlContext,
          activePlugins: enabledPluginsPayload,
          activeSkills: enabledSkillsPayload,
          activeApiConnectors: enabledConnectorsPayload,
          githubRepo: activeProject.githubRepo ?? null,
          fallbackOnQuota: activeProject.fallbackOnQuota ?? true,
        }),
      });

      if (!res.ok || !res.body) {
        const errJson = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errJson.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let stepsAcc: AgentStep[] = [];
      type StreamDoneResult = {
        explanation?: string;
        summary?: string;
        operations?: FileOperation[];
        agentSteps?: AgentStep[];
        thoughts?: string;
        groundingSources?: GroundingSource[];
        modelUsed?: StudioModelId;
        latencyMs?: number;
        totalTokens?: number;
      };
      let finalResult: StreamDoneResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        const frames = sseBuffer.split("\n\n");
        sseBuffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6)) as {
            type?: string;
            status?: string;
            thoughts?: string;
            content?: string;
            step?: AgentStep;
            error?: string;
            result?: StreamDoneResult;
          };

          if (payload.type === "status" && payload.status) {
            patchStreamingMsg({ streamingStatus: payload.status });
          } else if (payload.type === "thoughts" && payload.thoughts) {
            patchStreamingMsg({ thoughts: payload.thoughts });
          } else if (payload.type === "content" && payload.content) {
            patchStreamingMsg({ content: payload.content });
          } else if (payload.type === "step" && payload.step) {
            const incoming = payload.step;
            const existingIdx = stepsAcc.findIndex((s) => s.id === incoming.id);
            stepsAcc =
              existingIdx >= 0
                ? stepsAcc.map((s, idx) => (idx === existingIdx ? incoming : s))
                : [...stepsAcc, incoming];
            patchStreamingMsg({ agentSteps: stepsAcc });
          } else if (payload.type === "error") {
            throw new Error(payload.error || "Stream failed.");
          } else if (payload.type === "done" && payload.result) {
            finalResult = payload.result;
          }
        }
      }

      const data: StreamDoneResult = finalResult ?? { explanation: "Done." };
      const ops = data.operations ?? [];
      const previousFiles = { ...activeProject.files };
      const shouldAutoApply =
        activeProject.autoApplyChanges && ops.length > 0;

      if (shouldAutoApply) {
        const nextFiles = applyOperationsToFiles(previousFiles, ops);
        pushFilesWithUndo(nextFiles, data.summary || "AI Studio Update");
        const firstChanged = ops.find((o) => o.action !== "delete")?.path;
        if (firstChanged) {
          updateActiveProject((p) => ({
            ...p,
            activeFile: firstChanged,
            openTabs: p.openTabs.includes(firstChanged)
              ? p.openTabs
              : [...p.openTabs, firstChanged],
          }));
        }
      }

      patchStreamingMsg({
        content: data.explanation ?? "Done.",
        summary: data.summary,
        thoughts: data.thoughts,
        agentSteps: data.agentSteps ?? stepsAcc,
        operations: ops,
        changeState:
          ops.length > 0
            ? {
                previousFiles,
                status: shouldAutoApply ? "accepted" : "pending",
              }
            : undefined,
        groundingSources: data.groundingSources,
        modelUsed: data.modelUsed ?? activeProject.model,
        latencyMs: data.latencyMs,
        totalTokens: data.totalTokens,
        streamingStatus: undefined,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        updateActiveProject((proj) => ({
          ...proj,
          conversations: proj.conversations.map((c) =>
            c.id === activeConv.id
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.streamingStatus
                      ? {
                          ...m,
                          streamingStatus: undefined,
                          content: m.content || "Generation stopped.",
                        }
                      : m
                  ),
                }
              : c
          ),
        }));
      } else {
        const errMsgText =
          err instanceof Error ? err.message : "Failed to generate response.";
        updateActiveProject((proj) => ({
          ...proj,
          conversations: proj.conversations.map((c) =>
            c.id === activeConv.id
              ? {
                  ...c,
                  messages: [
                    ...c.messages.filter(
                      (m) => !(m.role === "assistant" && m.streamingStatus && !m.content)
                    ),
                    {
                      id: crypto.randomUUID(),
                      role: "assistant",
                      content: "",
                      error: errMsgText,
                      createdAt: Date.now(),
                    },
                  ],
                  updatedAt: Date.now(),
                }
              : c
          ),
        }));
      }
    } finally {
      abortRef.current = null;
      setIsGenerating(false);
    }
  };

  const detectGitHubTerminalAction = (
    command: string
  ): { targetRepo?: string; actionLabel: string } | null => {
    const repoMatch = command.match(
      /github\.com[/:]([^\s/]+)\/([^\s/."']+)/i
    );
    const extractedRepo = repoMatch
      ? `${repoMatch[1]}/${repoMatch[2].replace(/\.git$/i, "")}`
      : activeProject?.githubRepo
      ? `${activeProject.githubRepo.owner}/${activeProject.githubRepo.repo}`
      : undefined;

    if (
      /(?:^|[;&\n]\s*)(?:gh\s+(?:auth|repo)|github\s+(?:connect|login|auth|status)|connect\s+github)\b/i.test(
        command
      )
    ) {
      return {
        targetRepo: extractedRepo,
        actionLabel: "Connect GitHub Account to Studio Terminal",
      };
    }

    if (repoMatch) {
      return {
        targetRepo: extractedRepo,
        actionLabel: `Connect & sync with GitHub repository (${extractedRepo})`,
      };
    }

    if (/\bgit\s+(?:push|pull|fetch|clone|remote\s+(?:add|set-url))\b/i.test(command)) {
      return {
        targetRepo: extractedRepo,
        actionLabel: extractedRepo
          ? `Authorize GitHub remote action (${extractedRepo})`
          : "Authorize GitHub remote Git action",
      };
    }

    return null;
  };

  const executeTerminalCommandInternal = async (
    command: string,
    convId: string,
    overrideToken?: string,
    overrideUser?: GitHubUser | null
  ) => {
    if (!activeProject) return;
    const effectiveToken = overrideToken ?? githubToken;
    const effectiveUser = overrideUser ?? githubUser;

    setIsRunningTerminal(true);
    try {
      const res = await fetch("/api/terminal/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: activeProject.id,
          command,
          files: activeProject.files,
          githubToken: effectiveToken || undefined,
          githubLogin: effectiveUser?.login || undefined,
          gitAuthorName:
            effectiveUser?.name ||
            effectiveUser?.login ||
            "Hydrogen AI Studio",
        }),
      });

      const data = (await res.json()) as {
        exitCode?: number;
        output?: string;
        durationMs?: number;
        updatedFiles?: Record<string, string>;
        changedPaths?: string[];
        detectedGitHubRepo?: {
          owner: string;
          repo: string;
          branch: string;
        } | null;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? `Terminal failed (${res.status})`);
      }

      if (data.updatedFiles) {
        pushFilesWithUndo(
          data.updatedFiles,
          `Terminal: ${command.split("\n")[0].slice(0, 36)}`
        );
      }

      if (data.detectedGitHubRepo) {
        updateActiveProject((p) => ({
          ...p,
          githubRepo: {
            ...data.detectedGitHubRepo!,
            lastSyncedAt: Date.now(),
          },
        }));
      }

      const terminalMsg: AssistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.output ?? "",
        terminal: {
          command,
          exitCode: data.exitCode ?? 0,
          output: data.output ?? "(completed with no output)",
          changedPaths: data.changedPaths,
        },
        createdAt: Date.now(),
        latencyMs: data.durationMs,
      };

      updateActiveProject((proj) => ({
        ...proj,
        conversations: proj.conversations.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: [...c.messages, terminalMsg],
                updatedAt: Date.now(),
              }
            : c
        ),
      }));
    } catch (err) {
      const errMsg: AssistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        error:
          err instanceof Error ? err.message : "Terminal execution failed.",
        createdAt: Date.now(),
      };
      updateActiveProject((proj) => ({
        ...proj,
        conversations: proj.conversations.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: [...c.messages, errMsg],
                updatedAt: Date.now(),
              }
            : c
        ),
      }));
    } finally {
      setIsRunningTerminal(false);
    }
  };

  const handleRunTerminal = async (
    command: string,
    options?: { baseMessages?: AssistantMessage[] }
  ) => {
    if (!activeProject || isRunningTerminal) return;

    const convId = activeProject.activeConversationId;
    const activeConv =
      activeProject.conversations.find((c) => c.id === convId) ??
      activeProject.conversations[0];
    const baseMsgs = options?.baseMessages ?? activeConv?.messages ?? [];

    const userMsg: AssistantMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: `$ ${command}`,
      createdAt: Date.now(),
    };

    const isFirstMsg = baseMsgs.length === 0;
    const autoConvTitle = isFirstMsg
      ? `$ ${command.split("\n")[0]}`.slice(0, 42)
      : undefined;

    const ghAction = detectGitHubTerminalAction(command);

    if (ghAction) {
      const authReq: GitHubAuthRequest = {
        id: crypto.randomUUID(),
        command,
        targetRepo: ghAction.targetRepo,
        actionLabel: ghAction.actionLabel,
        status: "pending",
      };
      const authMsg: AssistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        githubAuthRequest: authReq,
        createdAt: Date.now(),
      };
      updateActiveProject((proj) => ({
        ...proj,
        conversations: proj.conversations.map((c) =>
          c.id === activeConv.id
            ? {
                ...c,
                title: autoConvTitle ?? c.title,
                messages: [...baseMsgs, userMsg, authMsg],
                updatedAt: Date.now(),
              }
            : c
        ),
      }));
      return;
    }

    updateActiveProject((proj) => ({
      ...proj,
      conversations: proj.conversations.map((c) =>
        c.id === activeConv.id
          ? {
              ...c,
              title: autoConvTitle ?? c.title,
              messages: [...baseMsgs, userMsg],
              updatedAt: Date.now(),
            }
          : c
      ),
    }));

    await executeTerminalCommandInternal(command, activeConv.id);
  };

  const handleEditMessage = async (
    messageId: string,
    newContent: string,
    resend: boolean
  ) => {
    if (!activeProject || isGenerating || isRunningTerminal) return;
    const trimmed = newContent.trim();
    if (!trimmed) return;

    const activeConv =
      activeProject.conversations.find(
        (c) => c.id === activeProject.activeConversationId
      ) ?? activeProject.conversations[0];
    if (!activeConv) return;

    const msgIndex = activeConv.messages.findIndex((m) => m.id === messageId);
    if (msgIndex < 0) return;
    const targetMsg = activeConv.messages[msgIndex];

    if (!resend) {
      updateActiveProject((p) => ({
        ...p,
        conversations: p.conversations.map((c) =>
          c.id === activeConv.id
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === messageId ? { ...m, content: trimmed } : m
                ),
                updatedAt: Date.now(),
              }
            : c
        ),
      }));
      return;
    }

    const priorMessages = activeConv.messages.slice(0, msgIndex);
    const existingAttachments = targetMsg.attachments ?? [];

    if (targetMsg.content.startsWith("$ ") || trimmed.startsWith("$ ")) {
      const cmdText = trimmed.replace(/^\$\s*/, "");
      await handleRunTerminal(cmdText, { baseMessages: priorMessages });
    } else {
      await handleSendPrompt(trimmed, existingAttachments, {
        baseMessages: priorMessages,
      });
    }
  };

  const handleRenameConversation = (conversationId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    updateActiveProject((p) => ({
      ...p,
      conversations: p.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, title: trimmed, updatedAt: Date.now() }
          : c
      ),
    }));
  };

  const handleAllowGitHubAuthRequest = async (
    messageId: string,
    tokenOverride?: string
  ) => {
    if (!activeProject) return;
    const activeConv =
      activeProject.conversations.find(
        (c) => c.id === activeProject.activeConversationId
      ) ?? activeProject.conversations[0];
    const msg = activeConv?.messages.find((m) => m.id === messageId);
    const req = msg?.githubAuthRequest;
    if (!req) return;

    let verifiedToken = tokenOverride?.trim() || githubToken;
    let verifiedUser: GitHubUser | null = githubUser;

    if (tokenOverride && tokenOverride.trim()) {
      const res = await fetch("/api/github/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenOverride.trim() }),
      });
      const data = (await res.json()) as {
        user?: GitHubUser;
        repos?: GitHubRepoSummary[];
        error?: string;
      };
      if (!res.ok || !data.user) {
        throw new Error(data.error || "GitHub authentication failed.");
      }
      verifiedToken = tokenOverride.trim();
      verifiedUser = data.user;
      setGithubToken(verifiedToken);
      setGithubUser(data.user);
      setGithubRepos(data.repos ?? []);
    }

    if (!verifiedToken) {
      throw new Error("Please authorize a GitHub account or token first.");
    }

    updateActiveProject((proj) => ({
      ...proj,
      conversations: proj.conversations.map((c) =>
        c.id === activeConv.id
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId && m.githubAuthRequest
                  ? {
                      ...m,
                      githubAuthRequest: {
                        ...m.githubAuthRequest,
                        status: "allowed",
                        resolvedAt: Date.now(),
                      },
                    }
                  : m
              ),
              updatedAt: Date.now(),
            }
          : c
      ),
    }));

    await executeTerminalCommandInternal(
      req.command,
      activeConv.id,
      verifiedToken,
      verifiedUser
    );
  };

  const handleDenyGitHubAuthRequest = (messageId: string) => {
    updateActiveProject((proj) => ({
      ...proj,
      conversations: proj.conversations.map((c) =>
        c.id === proj.activeConversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId && m.githubAuthRequest
                  ? {
                      ...m,
                      githubAuthRequest: {
                        ...m.githubAuthRequest,
                        status: "denied",
                        resolvedAt: Date.now(),
                      },
                    }
                  : m
              ),
              updatedAt: Date.now(),
            }
          : c
      ),
    }));
  };

  const handleAcceptChanges = (messageId: string) => {
    const conv = activeProject.conversations.find(
      (c) => c.id === activeProject.activeConversationId
    );
    const msg = conv?.messages.find((m) => m.id === messageId);
    if (!msg?.operations) return;

    const previousFiles = { ...activeProject.files };
    const nextFiles = applyOperationsToFiles(previousFiles, msg.operations);
    pushFilesWithUndo(nextFiles, msg.summary || "Accepted AI Changes");

    updateActiveProject((proj) => ({
      ...proj,
      conversations: proj.conversations.map((c) =>
        c.id === proj.activeConversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      changeState: { previousFiles, status: "accepted" },
                    }
                  : m
              ),
            }
          : c
      ),
    }));
  };

  const handleRejectChanges = (messageId: string) => {
    updateActiveProject((proj) => ({
      ...proj,
      conversations: proj.conversations.map((c) =>
        c.id === proj.activeConversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId && m.changeState
                  ? {
                      ...m,
                      changeState: { ...m.changeState, status: "rejected" },
                    }
                  : m
              ),
            }
          : c
      ),
    }));
  };

  const handleRevertChanges = (messageId: string) => {
    const conv = activeProject.conversations.find(
      (c) => c.id === activeProject.activeConversationId
    );
    const msg = conv?.messages.find((m) => m.id === messageId);
    if (!msg?.changeState?.previousFiles) return;

    pushFilesWithUndo(
      msg.changeState.previousFiles,
      `Reverted: ${msg.summary || "AI Edit"}`
    );

    updateActiveProject((proj) => ({
      ...proj,
      conversations: proj.conversations.map((c) =>
        c.id === proj.activeConversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId && m.changeState
                  ? {
                      ...m,
                      changeState: { ...m.changeState, status: "reverted" },
                    }
                  : m
              ),
            }
          : c
      ),
    }));
  };

  // Plugins, Skills, Connectors & GitHub Handlers
  const handleTogglePlugin = (id: string) => {
    updateActiveProject((p) => {
      const exists = p.enabledPluginIds.includes(id);
      return {
        ...p,
        enabledPluginIds: exists
          ? p.enabledPluginIds.filter((x) => x !== id)
          : [...p.enabledPluginIds, id],
      };
    });
  };

  const handleAddCustomPlugin = (
    plugin: Omit<StudioPlugin, "id" | "isCustom">
  ) => {
    const created: StudioPlugin = {
      ...plugin,
      id: `plugin-${crypto.randomUUID()}`,
      isCustom: true,
    };
    setCustomPlugins((prev) => [...prev, created]);
    updateActiveProject((p) => ({
      ...p,
      enabledPluginIds: [...p.enabledPluginIds, created.id],
    }));
  };

  const handleDeleteCustomPlugin = (id: string) => {
    setCustomPlugins((prev) => prev.filter((p) => p.id !== id));
    updateActiveProject((p) => ({
      ...p,
      enabledPluginIds: p.enabledPluginIds.filter((x) => x !== id),
    }));
  };

  const handleToggleSkill = (id: string) => {
    updateActiveProject((p) => {
      const exists = p.enabledSkillIds.includes(id);
      return {
        ...p,
        enabledSkillIds: exists
          ? p.enabledSkillIds.filter((x) => x !== id)
          : [...p.enabledSkillIds, id],
      };
    });
  };

  const handleAddCustomSkill = (skill: Omit<StudioSkill, "id" | "isCustom">) => {
    const created: StudioSkill = {
      ...skill,
      id: `skill-${crypto.randomUUID()}`,
      isCustom: true,
    };
    setCustomSkills((prev) => [...prev, created]);
    updateActiveProject((p) => ({
      ...p,
      enabledSkillIds: [...p.enabledSkillIds, created.id],
    }));
  };

  const handleDeleteCustomSkill = (id: string) => {
    setCustomSkills((prev) => prev.filter((s) => s.id !== id));
    updateActiveProject((p) => ({
      ...p,
      enabledSkillIds: p.enabledSkillIds.filter((x) => x !== id),
    }));
  };

  const handleAddApiConnector = (connector: Omit<ApiConnector, "id">) => {
    const created: ApiConnector = {
      ...connector,
      id: `conn-${crypto.randomUUID()}`,
    };
    setApiConnectors((prev) => [...prev, created]);
  };

  const handleTestApiConnector = async (id: string) => {
    const target = apiConnectors.find((c) => c.id === id);
    if (!target) return;
    try {
      const res = await fetch("/api/connectors/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: target.url,
          method: target.method,
          authHeader: target.authHeader,
        }),
      });
      const data = (await res.json()) as {
        status?: number;
        preview?: string;
        error?: string;
      };
      setApiConnectors((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                lastStatus: data.status ?? res.status,
                lastResponsePreview:
                  data.preview ?? data.error ?? "No response body",
              }
            : c
        )
      );
    } catch (err) {
      setApiConnectors((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                lastStatus: 0,
                lastResponsePreview:
                  err instanceof Error ? err.message : "Request failed",
              }
            : c
        )
      );
    }
  };

  const handleConnectGitHubToken = async (token: string) => {
    const res = await fetch("/api/github/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = (await res.json()) as {
      user?: GitHubUser;
      repos?: GitHubRepoSummary[];
      error?: string;
    };
    if (!res.ok || !data.user) {
      throw new Error(data.error || "GitHub authentication failed.");
    }
    setGithubToken(token);
    setGithubUser(data.user);
    setGithubRepos(data.repos ?? []);
  };

  const handleDisconnectGitHub = () => {
    setGithubToken("");
    setGithubUser(null);
    setGithubRepos([]);
  };

  const handleImportGitHubRepo = async (repoInput: string, branch?: string) => {
    const res = await fetch("/api/github/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoInput,
        branch,
        token: githubToken || undefined,
      }),
    });
    const data = (await res.json()) as {
      owner?: string;
      repo?: string;
      branch?: string;
      files?: Record<string, string>;
      error?: string;
    };
    if (!res.ok || !data.files || !data.owner || !data.repo || !data.branch) {
      throw new Error(data.error || "Failed to import repository.");
    }
    const importedFiles = data.files;
    pushFilesWithUndo(
      importedFiles,
      `Imported GitHub: ${data.owner}/${data.repo}`
    );
    const preferredFile =
      ["src/App.tsx", "src/App.jsx", "index.html"].find(
        (f) => f in importedFiles
      ) ?? Object.keys(importedFiles)[0] ?? "";
    updateActiveProject((p) => ({
      ...p,
      name: data.repo || p.name,
      activeFile: preferredFile,
      openTabs: preferredFile ? [preferredFile] : [],
      githubRepo: {
        owner: data.owner!,
        repo: data.repo!,
        branch: data.branch!,
        lastSyncedAt: Date.now(),
      },
    }));
  };

  const handlePushGitHubRepo = async (commitMessage: string) => {
    if (!activeProject.githubRepo || !githubToken) {
      throw new Error("Connect GitHub and link a repository first.");
    }
    const res = await fetch("/api/github/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: githubToken,
        owner: activeProject.githubRepo.owner,
        repo: activeProject.githubRepo.repo,
        branch: activeProject.githubRepo.branch,
        message: commitMessage,
        files: activeProject.files,
      }),
    });
    const data = (await res.json()) as {
      commitUrl?: string;
      error?: string;
    };
    if (!res.ok || !data.commitUrl) {
      throw new Error(data.error || "Failed to push to GitHub.");
    }
    updateActiveProject((p) => ({
      ...p,
      githubRepo: p.githubRepo
        ? {
            ...p.githubRepo,
            lastSyncedAt: Date.now(),
            lastCommitUrl: data.commitUrl,
          }
        : null,
    }));
    return { commitUrl: data.commitUrl };
  };

  // Export Project as ZIP
  const handleExportZip = async () => {
    if (!activeProject) return;
    const zip = new JSZip();
    for (const [filePath, content] of Object.entries(activeProject.files)) {
      zip.file(filePath, content);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeProject.name.replace(/[^a-z0-9-_]+/gi, "-")}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!activeProject) return null;

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-50 dark:bg-[#111318] text-slate-900 dark:text-[#F5F5F5]">
      {/* Top Navigation Toolbar */}
      <TopToolbar
        project={activeProject}
        saveLabel={saveLabel}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onRenameProject={(name) => updateActiveProject((p) => ({ ...p, name }))}
        onModelChange={(model: StudioModelId) => {
          const def = STUDIO_MODELS.find((m) => m.id === model) ?? STUDIO_MODELS[0];
          try {
            localStorage.setItem(STORAGE_DEFAULT_MODEL_KEY, model);
          } catch {
            // Ignore
          }
          updateActiveProject((p) => ({
            ...p,
            model,
            thinkingLevel: def.supportedThinkingLevels.includes(p.thinkingLevel)
              ? p.thinkingLevel
              : def.defaultThinkingLevel,
          }));
        }}
        onOpenProjects={() => setModal("projects")}
        onOpenVersions={() => setModal("versions")}
        onOpenShare={() => setModal("share")}
        onExportZip={handleExportZip}
        onOpenSettings={() => setModal("settings")}
      />

      {/* Mobile Primary Panel Toggle */}
      <div className="md:hidden flex items-center justify-between px-3 py-1.5 border-b border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23]">
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-[#111318] border border-slate-200 dark:border-[#292E38]">
          <button
            type="button"
            onClick={() => setMobileSection("chat")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
              mobileSection === "chat"
                ? "bg-white dark:bg-[#222630] text-slate-900 dark:text-[#F5F5F5]"
                : "text-slate-500 dark:text-[#9CA3AF]"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Assistant</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileSection("split")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
              mobileSection === "split"
                ? "bg-white dark:bg-[#222630] text-slate-900 dark:text-[#F5F5F5]"
                : "text-slate-500 dark:text-[#9CA3AF]"
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>Split</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileSection("workspace")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
              mobileSection === "workspace"
                ? "bg-white dark:bg-[#222630] text-slate-900 dark:text-[#F5F5F5]"
                : "text-slate-500 dark:text-[#9CA3AF]"
            }`}
          >
            <PanelLeft className="w-3.5 h-3.5" />
            <span>Workspace</span>
          </button>
        </div>

        {mobileSection === "chat" && (
          <button
            type="button"
            onClick={() => {
              setViewMode("preview");
              setMobileSection("split");
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#4285F4]/15 text-[#4285F4] text-xs font-medium cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>
        )}
      </div>

      {/* Main Split-Screen Workspace */}
      <div
        ref={containerRef}
        className={`flex-1 flex min-h-0 overflow-hidden ${
          mobileSection === "split" ? "flex-col md:flex-row" : "flex-row"
        }`}
      >
        {/* LEFT PANEL: AI Assistant (25-30% width on desktop) */}
        <div
          style={{ width: `${leftWidthPct}%` }}
          className={`${
            mobileSection === "chat"
              ? "flex !w-full flex-1 h-full"
              : mobileSection === "split"
              ? "flex !w-full order-2 flex-1 min-h-0 md:order-none md:flex-none md:h-full"
              : "hidden md:h-full"
          } md:flex flex-col shrink-0 overflow-hidden`}
        >
          <AssistantPanel
            project={activeProject}
            allProjects={projects}
            onSwitchProject={(id) => {
              setActiveProjectId(id);
              setUndoStack([]);
              setRedoStack([]);
            }}
            onSelectConversation={(convId) =>
              updateActiveProject((p) => ({
                ...p,
                activeConversationId: convId,
              }))
            }
            onNewConversation={() => {
              const id = crypto.randomUUID();
              updateActiveProject((p) => ({
                ...p,
                conversations: [
                  {
                    id,
                    title: "New Chat",
                    messages: [],
                    updatedAt: Date.now(),
                  },
                  ...p.conversations,
                ],
                activeConversationId: id,
              }));
            }}
            onDeleteConversation={(convId) => {
              updateActiveProject((p) => {
                const remaining = p.conversations.filter((c) => c.id !== convId);
                if (remaining.length === 0) {
                  const freshId = crypto.randomUUID();
                  return {
                    ...p,
                    conversations: [
                      {
                        id: freshId,
                        title: "New Chat",
                        messages: [],
                        updatedAt: Date.now(),
                      },
                    ],
                    activeConversationId: freshId,
                  };
                }
                return {
                  ...p,
                  conversations: remaining,
                  activeConversationId:
                    p.activeConversationId === convId
                      ? remaining[0].id
                      : p.activeConversationId,
                };
              });
            }}
            onDeleteAllConversations={() => {
              const freshId = crypto.randomUUID();
              updateActiveProject((p) => ({
                ...p,
                conversations: [
                  {
                    id: freshId,
                    title: "New Chat",
                    messages: [],
                    updatedAt: Date.now(),
                  },
                ],
                activeConversationId: freshId,
              }));
            }}
            onDeleteMessage={(messageId) => {
              updateActiveProject((p) => ({
                ...p,
                conversations: p.conversations.map((c) =>
                  c.id === p.activeConversationId
                    ? {
                        ...c,
                        messages: c.messages.filter((m) => m.id !== messageId),
                        updatedAt: Date.now(),
                      }
                    : c
                ),
              }));
            }}
            onEditMessage={handleEditMessage}
            onRenameConversation={handleRenameConversation}
            onSendPrompt={handleSendPrompt}
            onRunTerminal={handleRunTerminal}
            onStopGeneration={() => abortRef.current?.abort()}
            isGenerating={isGenerating}
            isRunningTerminal={isRunningTerminal}
            onAcceptChanges={handleAcceptChanges}
            onRejectChanges={handleRejectChanges}
            onRevertChanges={handleRevertChanges}
            onSelectFile={handleSelectFile}
            externalDraftPrompt={externalDraftPrompt}
            onConsumeExternalDraft={() => setExternalDraftPrompt("")}
            plugins={allPlugins}
            skills={allSkills}
            apiConnectors={apiConnectors}
            githubToken={githubToken}
            githubUser={githubUser}
            githubRepos={githubRepos}
            onTogglePlugin={handleTogglePlugin}
            onAddCustomPlugin={handleAddCustomPlugin}
            onDeleteCustomPlugin={handleDeleteCustomPlugin}
            onToggleSkill={handleToggleSkill}
            onAddCustomSkill={handleAddCustomSkill}
            onDeleteCustomSkill={handleDeleteCustomSkill}
            onToggleSearch={() =>
              updateActiveProject((p) => ({ ...p, useSearch: !p.useSearch }))
            }
            onToggleUrlContext={() =>
              updateActiveProject((p) => ({
                ...p,
                useUrlContext: !p.useUrlContext,
              }))
            }
            onAddApiConnector={handleAddApiConnector}
            onToggleApiConnector={(id) =>
              setApiConnectors((prev) =>
                prev.map((c) =>
                  c.id === id ? { ...c, enabled: !c.enabled } : c
                )
              )
            }
            onDeleteApiConnector={(id) =>
              setApiConnectors((prev) => prev.filter((c) => c.id !== id))
            }
            onTestApiConnector={handleTestApiConnector}
            onConnectGitHubToken={handleConnectGitHubToken}
            onDisconnectGitHub={handleDisconnectGitHub}
            onImportGitHubRepo={handleImportGitHubRepo}
            onPushGitHubRepo={handlePushGitHubRepo}
            onAllowGitHubAuth={handleAllowGitHubAuthRequest}
            onDenyGitHubAuth={handleDenyGitHubAuthRequest}
            onChangeThinkingLevel={(thinkingLevel) =>
              updateActiveProject((p) => ({ ...p, thinkingLevel }))
            }
            onChangeModel={(model: StudioModelId) => {
              const def =
                STUDIO_MODELS.find((m) => m.id === model) ?? STUDIO_MODELS[0];
              try {
                localStorage.setItem(STORAGE_DEFAULT_MODEL_KEY, model);
              } catch {
                // Ignore
              }
              updateActiveProject((p) => ({
                ...p,
                model,
                thinkingLevel: def.supportedThinkingLevels.includes(
                  p.thinkingLevel
                )
                  ? p.thinkingLevel
                  : def.defaultThinkingLevel,
              }));
            }}
          />
        </div>

        {/* Resizable Left-Right Divider */}
        <div
          onMouseDown={() => {
            dragTargetRef.current = "left";
            document.body.style.cursor = "col-resize";
          }}
          title="Drag to resize AI Assistant"
          className="hidden md:block w-1 shrink-0 bg-transparent hover:bg-[#4285F4]/60 transition-colors cursor-col-resize"
        />

        {/* RIGHT PANEL: Development Workspace (70-75% width on desktop) */}
        <main
          className={`${
            mobileSection === "workspace"
              ? "flex flex-1 h-full"
              : mobileSection === "split"
              ? "flex order-1 h-[44%] shrink-0 border-b border-slate-200 dark:border-[#292E38] md:order-none md:h-full md:flex-1 md:border-b-0"
              : "hidden"
          } md:flex flex-1 flex-col min-w-0 overflow-hidden`}
        >
          {/* Workspace Mode Toolbar: Preview | Code | Split */}
          <div className="h-10 shrink-0 px-3 border-b border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-[#111318] border border-slate-200 dark:border-[#292E38]">
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === "preview"
                    ? "bg-white dark:bg-[#222630] text-slate-900 dark:text-[#F5F5F5] shadow-xs"
                    : "text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5]"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("code")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === "code"
                    ? "bg-white dark:bg-[#222630] text-slate-900 dark:text-[#F5F5F5] shadow-xs"
                    : "text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5]"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Code</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === "split"
                    ? "bg-white dark:bg-[#222630] text-slate-900 dark:text-[#F5F5F5] shadow-xs"
                    : "text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5]"
                }`}
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>Split</span>
              </button>
            </div>

            <div className="text-[11px] font-mono text-slate-500 dark:text-[#9CA3AF] tabular-nums truncate">
              {isBundling
                ? "Building preview..."
                : diagnostics.length > 0
                ? `${diagnostics.length} problem(s)`
                : "Ready"}
            </div>
          </div>

          {/* Workspace Content: Preview / Code / Split */}
          <div
            ref={rightAreaRef}
            className="flex-1 flex min-h-0 overflow-hidden"
          >
            {(viewMode === "code" || viewMode === "split") && (
              <div
                style={{
                  width: viewMode === "split" ? `${splitCodePct}%` : "100%",
                }}
                className="h-full min-w-0 overflow-hidden"
              >
                <CodeWorkspace
                  files={activeProject.files}
                  openTabs={activeProject.openTabs}
                  activeFile={activeProject.activeFile}
                  theme={theme}
                  diagnostics={diagnostics}
                  consoleEntries={consoleEntries}
                  buildLogs={buildLogs}
                  runtimeErrors={runtimeErrors}
                  onSelectFile={handleSelectFile}
                  onCloseTab={handleCloseTab}
                  onUpdateFileContent={handleUpdateFileContent}
                  onCreateFile={handleCreateFile}
                  onRenameFile={handleRenameFile}
                  onDeleteFile={handleDeleteFile}
                  onClearConsole={() => setConsoleEntries([])}
                  onRunBuild={() =>
                    runBundle(activeProject.id, activeProject.files)
                  }
                  onAskAiEdit={(prompt) => {
                    setExternalDraftPrompt(prompt);
                    setMobileSection("chat");
                  }}
                />
              </div>
            )}

            {viewMode === "split" && (
              <div
                onMouseDown={() => {
                  dragTargetRef.current = "split";
                  document.body.style.cursor = "col-resize";
                }}
                title="Drag to resize code and preview"
                className="w-1 shrink-0 bg-slate-200 dark:bg-[#292E38] hover:bg-[#4285F4] transition-colors cursor-col-resize"
              />
            )}

            {(viewMode === "preview" || viewMode === "split") && (
              <div className="flex-1 h-full min-w-0 overflow-hidden">
                <PreviewWorkspace
                  projectId={activeProject.id}
                  bundledHtml={bundledHtml}
                  isBundling={isBundling}
                  previewKey={previewKey}
                  onRefresh={() => {
                    setPreviewKey((k) => k + 1);
                    runBundle(activeProject.id, activeProject.files);
                  }}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      {modal === "projects" && (
        <ProjectsModal
          projects={projects}
          activeProjectId={activeProject.id}
          onSelect={(id) => {
            setActiveProjectId(id);
            setUndoStack([]);
            setRedoStack([]);
          }}
          onCreate={(name) => {
            const base = createNewProject(name);
            const preferredModel = getPreferredDefaultModel();
            const def =
              STUDIO_MODELS.find((m) => m.id === preferredModel) ??
              STUDIO_MODELS[0];
            const created: StudioProject = {
              ...base,
              model: preferredModel,
              thinkingLevel: def.defaultThinkingLevel,
            };
            setProjects((prev) => [created, ...prev]);
            setActiveProjectId(created.id);
            setUndoStack([]);
            setRedoStack([]);
          }}
          onDelete={(id) => {
            setProjects((prev) => {
              const remaining = prev.filter((p) => p.id !== id);
              if (remaining.length === 0) return prev;
              if (id === activeProject.id) setActiveProjectId(remaining[0].id);
              return remaining;
            });
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "versions" && (
        <VersionsModal
          versions={activeProject.versions}
          onSaveSnapshot={(label) => {
            const snap: ProjectVersion = {
              id: crypto.randomUUID(),
              label,
              createdAt: Date.now(),
              files: { ...activeProject.files },
              changedFilesCount: Object.keys(activeProject.files).length,
            };
            updateActiveProject((p) => ({
              ...p,
              versions: [snap, ...p.versions],
            }));
          }}
          onRestore={(version) => {
            pushFilesWithUndo(
              version.files,
              `Restored: ${version.label}`
            );
          }}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "share" && (
        <ShareModal
          project={activeProject}
          bundledHtml={bundledHtml}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "settings" && (
        <SettingsModal
          project={activeProject}
          theme={theme}
          onToggleTheme={() =>
            setTheme((prev) => (prev === "dark" ? "light" : "dark"))
          }
          onUpdateProject={(patch) => {
            if (patch.model) {
              try {
                localStorage.setItem(STORAGE_DEFAULT_MODEL_KEY, patch.model);
              } catch {
                // Ignore
              }
            }
            updateActiveProject((p) => ({ ...p, ...patch }));
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
