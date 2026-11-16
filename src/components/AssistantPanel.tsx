import React, { useEffect, useMemo, useRef, useState } from "react";
import { diffLines } from "diff";
import {
  ArrowUp,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FileCode2,
  GitBranch,
  History,
  Loader2,
  Paperclip,
  Pencil,
  Play,
  Plug,
  Plus,
  Puzzle,
  RotateCcw,
  ShieldCheck,
  Square,
  Terminal as TerminalIcon,
  Trash2,
  Wand2,
  Wrench,
  X,
} from "lucide-react";
import { QUICK_AI_PROMPTS, STUDIO_MODELS } from "../data/defaultProject.ts";
import {
  ApiConnector,
  AssistantMessage,
  AttachmentItem,
  ConversationThread,
  FileOperation,
  GitHubAuthRequest,
  GitHubRepoSummary,
  GitHubUser,
  StudioModelId,
  StudioPlugin,
  StudioProject,
  StudioSkill,
  ThinkingDepth,
} from "../types/studio.ts";
import { ExtensionsFieldBox, ExtensionTab } from "./ExtensionsFieldBox.tsx";
import { MarkdownRenderer } from "./MarkdownRenderer.tsx";

interface AssistantPanelProps {
  project: StudioProject;
  allProjects: StudioProject[];
  onSwitchProject: (projectId: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onDeleteAllConversations: () => void;
  onDeleteMessage: (messageId: string) => void;
  onEditMessage: (
    messageId: string,
    newContent: string,
    resend: boolean
  ) => Promise<void>;
  onRenameConversation: (conversationId: string, title: string) => void;
  onSendPrompt: (prompt: string, attachments: AttachmentItem[]) => Promise<void>;
  onRunTerminal: (command: string) => Promise<void>;
  onStopGeneration: () => void;
  isGenerating: boolean;
  isRunningTerminal: boolean;
  onAcceptChanges: (messageId: string) => void;
  onRejectChanges: (messageId: string) => void;
  onRevertChanges: (messageId: string) => void;
  onSelectFile: (filePath: string) => void;
  externalDraftPrompt?: string;
  onConsumeExternalDraft?: () => void;
  plugins: StudioPlugin[];
  skills: StudioSkill[];
  apiConnectors: ApiConnector[];
  githubToken: string;
  githubUser: GitHubUser | null;
  githubRepos: GitHubRepoSummary[];
  onTogglePlugin: (id: string) => void;
  onAddCustomPlugin: (plugin: Omit<StudioPlugin, "id" | "isCustom">) => void;
  onDeleteCustomPlugin: (id: string) => void;
  onToggleSkill: (id: string) => void;
  onAddCustomSkill: (skill: Omit<StudioSkill, "id" | "isCustom">) => void;
  onDeleteCustomSkill: (id: string) => void;
  onToggleSearch: () => void;
  onToggleUrlContext: () => void;
  onAddApiConnector: (connector: Omit<ApiConnector, "id">) => void;
  onToggleApiConnector: (id: string) => void;
  onDeleteApiConnector: (id: string) => void;
  onTestApiConnector: (id: string) => Promise<void>;
  onConnectGitHubToken: (token: string) => Promise<void>;
  onDisconnectGitHub: () => void;
  onImportGitHubRepo: (repoInput: string, branch?: string) => Promise<void>;
  onPushGitHubRepo: (commitMessage: string) => Promise<{ commitUrl: string }>;
  onAllowGitHubAuth: (messageId: string, tokenOverride?: string) => Promise<void>;
  onDenyGitHubAuth: (messageId: string) => void;
  onChangeThinkingLevel: (level: ThinkingDepth) => void;
  onChangeModel: (modelId: StudioModelId) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function FileDiffBlock({
  op,
  previousContent,
}: {
  op: FileOperation;
  previousContent: string;
}) {
  const parts = useMemo(() => {
    const nextContent = op.action === "delete" ? "" : op.content ?? "";
    return diffLines(previousContent, nextContent);
  }, [previousContent, op]);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-[#292E38] bg-slate-950 text-[11px] font-mono overflow-x-auto max-h-56 overflow-y-auto">
      {parts.map((part, idx) => {
        const lines = part.value.replace(/\n$/, "").split("\n");
        const bgClass = part.added
          ? "bg-emerald-950/60 text-emerald-300"
          : part.removed
          ? "bg-red-950/60 text-red-300"
          : "text-slate-400";
        const prefix = part.added ? "+" : part.removed ? "-" : " ";
        return lines.map((line, lineIdx) => (
          <div key={`${idx}-${lineIdx}`} className={`px-2.5 py-0.5 whitespace-pre ${bgClass}`}>
            <span className="select-none opacity-60 mr-2">{prefix}</span>
            {line}
          </div>
        ));
      })}
    </div>
  );
}

function GitHubLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function GitHubAuthCard({
  messageId,
  request,
  githubUser,
  hasToken,
  isBusy,
  onAllow,
  onDeny,
}: {
  messageId: string;
  request: GitHubAuthRequest;
  githubUser: GitHubUser | null;
  hasToken: boolean;
  isBusy: boolean;
  onAllow: (messageId: string, tokenOverride?: string) => Promise<void>;
  onDeny: (messageId: string) => void;
}) {
  const [needsTokenForm, setNeedsTokenForm] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);

  const handleAllowClick = async () => {
    setError(null);
    if (hasToken) {
      setSubmitting(true);
      try {
        await onAllow(messageId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Authorization failed.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setNeedsTokenForm(true);
    try {
      const cfgRes = await fetch("/api/github/oauth/config");
      const cfg = (await cfgRes.json()) as { configured?: boolean };
      if (cfg.configured) {
        const urlRes = await fetch("/api/github/oauth/url");
        const urlData = (await urlRes.json()) as { url?: string };
        if (urlData.url) setOauthUrl(urlData.url);
      }
    } catch {
      // Fallback to PAT authorization form
    }
  };

  useEffect(() => {
    if (!needsTokenForm) return;
    const onOAuthMsg = (ev: MessageEvent) => {
      const payload = ev.data as { type?: string; token?: string };
      if (payload?.type === "GITHUB_OAUTH_SUCCESS" && payload.token) {
        setSubmitting(true);
        onAllow(messageId, payload.token)
          .then(() => setNeedsTokenForm(false))
          .catch((err) =>
            setError(err instanceof Error ? err.message : "OAuth failed.")
          )
          .finally(() => setSubmitting(false));
      }
    };
    window.addEventListener("message", onOAuthMsg);
    return () => window.removeEventListener("message", onOAuthMsg);
  }, [needsTokenForm, messageId, onAllow]);

  const handleAuthorizeToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await onAllow(messageId, tokenInput.trim());
      setTokenInput("");
      setNeedsTokenForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid GitHub token.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] overflow-hidden shadow-sm">
      <div className="px-3 py-2 border-b border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="p-1 rounded-md bg-slate-900 text-white dark:bg-[#F5F5F5] dark:text-[#111318] shrink-0">
            <GitHubLogo className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-900 dark:text-[#F5F5F5] truncate">
              GitHub Authorization
            </div>
            {request.targetRepo && (
              <div className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 dark:text-[#9CA3AF] truncate">
                <GitBranch className="w-3 h-3 shrink-0" />
                <span className="truncate">{request.targetRepo}</span>
              </div>
            )}
          </div>
        </div>

        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded shrink-0 ${
            request.status === "allowed"
              ? "bg-[#22C55E]/15 text-[#22C55E]"
              : request.status === "denied"
              ? "bg-[#EF4444]/15 text-[#EF4444]"
              : "bg-[#4285F4]/15 text-[#4285F4]"
          }`}
        >
          {request.status === "allowed"
            ? "Allowed"
            : request.status === "denied"
            ? "Denied"
            : "Permission Required"}
        </span>
      </div>

      <div className="p-3 space-y-2.5 text-xs">
        <p className="text-slate-700 dark:text-[#F5F5F5] leading-relaxed">
          {request.actionLabel}
        </p>

        <pre className="rounded-lg border border-slate-200 dark:border-[#292E38] bg-slate-950 text-slate-200 px-2.5 py-2 text-[11px] font-mono whitespace-pre-wrap break-all max-h-28 overflow-y-auto">
          $ {request.command}
        </pre>

        {githubUser && hasToken && request.status === "pending" && (
          <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-[#9CA3AF]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>
              Signed in as{" "}
              <strong className="text-slate-900 dark:text-[#F5F5F5]">
                @{githubUser.login}
              </strong>
            </span>
          </div>
        )}

        {error && (
          <p className="text-[11px] text-[#EF4444]">{error}</p>
        )}

        {request.status === "pending" && !needsTokenForm && (
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              disabled={submitting || isBusy}
              onClick={handleAllowClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22C55E] hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Allow</span>
            </button>
            <button
              type="button"
              disabled={submitting || isBusy}
              onClick={() => onDeny(messageId)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-[#292E38] text-slate-700 dark:text-[#F5F5F5] hover:border-[#EF4444] hover:text-[#EF4444] text-xs font-medium cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Deny</span>
            </button>
          </div>
        )}

        {request.status === "pending" && needsTokenForm && (
          <form onSubmit={handleAuthorizeToken} className="space-y-2 pt-1 border-t border-slate-200 dark:border-[#292E38]">
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-[#9CA3AF]">
              <span>Authorize your GitHub account to continue:</span>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=Hydrogen%20AI%20Studio"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#4285F4] hover:underline shrink-0"
              >
                <span>Create Token</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {oauthUrl && (
              <a
                href={oauthUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-[#F5F5F5] dark:text-[#111318] text-white text-xs font-medium"
              >
                <GitHubLogo className="w-3.5 h-3.5" />
                <span>Authorize via GitHub OAuth</span>
              </a>
            )}

            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste GitHub token (ghp_... or github_pat_...)"
              className="w-full rounded-lg border border-slate-300 dark:border-[#292E38] bg-white dark:bg-[#191C23] px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5] focus:outline-none focus:border-[#4285F4]"
            />

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={submitting || !tokenInput.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22C55E] hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-medium cursor-pointer"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Allow & Run</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNeedsTokenForm(false);
                  onDeny(messageId);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-[#292E38] text-slate-600 dark:text-[#9CA3AF] hover:text-[#EF4444] text-xs cursor-pointer"
              >
                Deny
              </button>
            </div>
          </form>
        )}

        {request.status === "allowed" && (
          <div className="inline-flex items-center gap-1.5 text-[11px] text-[#22C55E]">
            <Check className="w-3.5 h-3.5" />
            <span>GitHub access allowed and command executed.</span>
          </div>
        )}

        {request.status === "denied" && (
          <div className="inline-flex items-center gap-1.5 text-[11px] text-[#EF4444]">
            <X className="w-3.5 h-3.5" />
            <span>GitHub access denied. Command was cancelled.</span>
          </div>
        )}
      </div>
    </div>
  );
}

export const AssistantPanel: React.FC<AssistantPanelProps> = ({
  project,
  allProjects,
  onSwitchProject,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  onDeleteAllConversations,
  onDeleteMessage,
  onEditMessage,
  onRenameConversation,
  onSendPrompt,
  onRunTerminal,
  onStopGeneration,
  isGenerating,
  isRunningTerminal,
  onAcceptChanges,
  onRejectChanges,
  onRevertChanges,
  onSelectFile,
  externalDraftPrompt,
  onConsumeExternalDraft,
  plugins,
  skills,
  apiConnectors,
  githubToken,
  githubUser,
  githubRepos,
  onTogglePlugin,
  onAddCustomPlugin,
  onDeleteCustomPlugin,
  onToggleSkill,
  onAddCustomSkill,
  onDeleteCustomSkill,
  onToggleSearch,
  onToggleUrlContext,
  onAddApiConnector,
  onToggleApiConnector,
  onDeleteApiConnector,
  onTestApiConnector,
  onConnectGitHubToken,
  onDisconnectGitHub,
  onImportGitHubRepo,
  onPushGitHubRepo,
  onAllowGitHubAuth,
  onDenyGitHubAuth,
  onChangeThinkingLevel,
  onChangeModel,
}) => {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [composerMode, setComposerMode] = useState<"chat" | "terminal">("chat");
  const [terminalCmdHistory, setTerminalCmdHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number>(-1);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [openExtensionTab, setOpenExtensionTab] =
    useState<ExtensionTab | null>(null);
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraftText, setEditDraftText] = useState("");
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const handleCopyText = async (messageId: string, text: string) => {
    const content = text ?? "";
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = content;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(ta);
      }
    }
    setCopiedMessageId(messageId);
    setTimeout(() => {
      setCopiedMessageId((prev) => (prev === messageId ? null : prev));
    }, 1600);
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activeConversation: ConversationThread =
    project.conversations.find((c) => c.id === project.activeConversationId) ??
    project.conversations[0];

  const messages: AssistantMessage[] = activeConversation?.messages ?? [];
  const fileCount = Object.keys(project.files).length;
  const activeModel =
    STUDIO_MODELS.find((m) => m.id === project.model) ?? STUDIO_MODELS[0];

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isGenerating]);

  useEffect(() => {
    if (externalDraftPrompt) {
      setInput(externalDraftPrompt);
      textareaRef.current?.focus();
      onConsumeExternalDraft?.();
    }
  }, [externalDraftPrompt, onConsumeExternalDraft]);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;

    const next: AttachmentItem[] = [];
    for (const file of picked) {
      if (file.size > 12 * 1024 * 1024) continue;
      const mimeType = file.type || "text/plain";
      const dataBase64 = await fileToBase64(file);
      next.push({
        id: crypto.randomUUID(),
        name: file.name,
        mimeType,
        dataBase64,
        sizeBytes: file.size,
        previewUrl: mimeType.startsWith("image/")
          ? `data:${mimeType};base64,${dataBase64}`
          : undefined,
      });
    }
    setAttachments((prev) => [...prev, ...next]);
  };

  const looksLikeShellScript = useMemo(() => {
    const lines = input
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return false;
    const cmdPattern =
      /^(git|npm|npx|yarn|pnpm|node|ls|cat|mkdir|touch|rm|mv|cp|echo|pwd|curl|bash|sh)\b/;
    return lines.every((line) => cmdPattern.test(line));
  }, [input]);

  const executeTerminal = async (rawCmd: string) => {
    const cmd = rawCmd.trim();
    if (!cmd || isGenerating || isRunningTerminal) return;
    setTerminalCmdHistory((prev) => [cmd, ...prev.slice(0, 29)]);
    setHistoryCursor(-1);
    setInput("");
    await onRunTerminal(cmd);
  };

  const handleSubmit = async () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || isGenerating || isRunningTerminal)
      return;

    if (composerMode === "terminal") {
      await executeTerminal(text);
      return;
    }

    if (attachments.length === 0) {
      if (text.startsWith("/sh ")) {
        await executeTerminal(text.slice(4));
        return;
      }
      if (text.startsWith("!") && text.length > 1) {
        await executeTerminal(text.slice(1));
        return;
      }
    }

    const currentAttachments = [...attachments];
    setInput("");
    setAttachments([]);
    await onSendPrompt(text, currentAttachments);
  };

  return (
    <aside className="h-full flex flex-col bg-white dark:bg-[#191C23] border-r border-slate-200 dark:border-[#292E38] overflow-hidden">
      {/* Assistant Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-[#292E38] flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          {renamingConvId === activeConversation?.id && !showHistoryDrawer ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (activeConversation && renameDraft.trim()) {
                  onRenameConversation(activeConversation.id, renameDraft);
                }
                setRenamingConvId(null);
              }}
              className="flex items-center gap-1"
            >
              <input
                type="text"
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setRenamingConvId(null);
                }}
                aria-label="Rename conversation"
                className="w-full rounded border border-[#4285F4] bg-slate-50 dark:bg-[#111318] px-1.5 py-0.5 text-xs font-semibold text-slate-900 dark:text-[#F5F5F5] focus:outline-none"
              />
              <button
                type="submit"
                title="Save chat title"
                className="p-1 text-[#22C55E] cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setRenamingConvId(null)}
                title="Cancel rename"
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1 min-w-0">
              <div className="text-xs font-semibold text-slate-900 dark:text-[#F5F5F5] truncate">
                {activeConversation?.title || "AI Assistant"}
              </div>
              {activeConversation && (
                <button
                  type="button"
                  onClick={() => {
                    setRenamingConvId(activeConversation.id);
                    setRenameDraft(activeConversation.title);
                  }}
                  title="Edit chat title"
                  aria-label="Edit chat title"
                  className="p-0.5 rounded text-slate-400 hover:text-[#4285F4] cursor-pointer shrink-0"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
          <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF] tabular-nums truncate">
            {activeModel.shortName} · {fileCount} files · {project.activeFile}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {messages.length > 0 && activeConversation && (
            <button
              type="button"
              onClick={() => onDeleteConversation(activeConversation.id)}
              title="Delete current conversation"
              aria-label="Delete current conversation"
              className="p-1.5 rounded-md border border-slate-200 dark:border-[#292E38] text-slate-500 dark:text-[#9CA3AF] hover:text-[#EF4444] hover:border-[#EF4444]/50 transition-colors cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowHistoryDrawer((p) => !p)}
            title="Conversations & recent projects"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showHistoryDrawer
                ? "border-[#4285F4] text-[#4285F4] bg-[#4285F4]/10"
                : "border-slate-200 dark:border-[#292E38] text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5]"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowHistoryDrawer(false);
              onNewConversation();
            }}
            title="Start a new conversation"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#4285F4] hover:bg-[#3574E2] text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* Collapsible History & Recent Projects Drawer */}
      {showHistoryDrawer && (
        <div className="border-b border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] p-3 space-y-3 max-h-64 overflow-y-auto shrink-0">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-slate-500 dark:text-[#9CA3AF]">
                Conversations ({project.conversations.length})
              </span>
              {(project.conversations.length > 1 || messages.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteAllConversations();
                    setShowHistoryDrawer(false);
                  }}
                  className="text-[11px] text-slate-500 dark:text-[#9CA3AF] hover:text-[#EF4444] cursor-pointer"
                >
                  Delete All
                </button>
              )}
            </div>
            {project.conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => {
                  if (renamingConvId === conv.id) return;
                  onSelectConversation(conv.id);
                  setShowHistoryDrawer(false);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renamingConvId !== conv.id) {
                    onSelectConversation(conv.id);
                    setShowHistoryDrawer(false);
                  }
                }}
                className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer ${
                  conv.id === project.activeConversationId
                    ? "bg-slate-200/70 dark:bg-[#222630] text-slate-900 dark:text-[#F5F5F5] font-medium"
                    : "text-slate-600 dark:text-[#9CA3AF] hover:bg-slate-100 dark:hover:bg-[#191C23]"
                }`}
              >
                <div className="min-w-0 flex-1">
                  {renamingConvId === conv.id ? (
                    <form
                      onClick={(e) => e.stopPropagation()}
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (renameDraft.trim()) {
                          onRenameConversation(conv.id, renameDraft);
                        }
                        setRenamingConvId(null);
                      }}
                      className="flex items-center gap-1"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setRenamingConvId(null);
                        }}
                        className="w-full rounded border border-[#4285F4] bg-white dark:bg-[#111318] px-1.5 py-0.5 text-xs text-slate-900 dark:text-[#F5F5F5] focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="p-0.5 text-[#22C55E] cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="truncate">{conv.title}</div>
                      <div className="text-[10px] text-slate-400 dark:text-[#9CA3AF] tabular-nums">
                        {conv.messages.length}{" "}
                        {conv.messages.length === 1 ? "message" : "messages"}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingConvId(conv.id);
                      setRenameDraft(conv.title);
                    }}
                    title="Rename conversation"
                    aria-label={`Rename conversation ${conv.title}`}
                    className="p-1 rounded text-slate-400 opacity-75 group-hover:opacity-100 hover:text-[#4285F4] cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    title="Delete conversation"
                    aria-label={`Delete conversation ${conv.title}`}
                    className="p-1 rounded text-slate-400 opacity-75 group-hover:opacity-100 hover:text-[#EF4444] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {allProjects.length > 1 && (
            <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-[#292E38]">
              <div className="text-[11px] font-medium text-slate-500 dark:text-[#9CA3AF]">
                Recent Projects
              </div>
              {allProjects.map((proj) => (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => {
                    onSwitchProject(proj.id);
                    setShowHistoryDrawer(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs truncate cursor-pointer ${
                    proj.id === project.id
                      ? "bg-[#4285F4]/15 text-[#4285F4] font-medium"
                      : "text-slate-600 dark:text-[#9CA3AF] hover:bg-slate-100 dark:hover:bg-[#191C23]"
                  }`}
                >
                  {proj.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#222630] p-3.5 space-y-1.5">
              <div className="text-xs font-semibold text-slate-900 dark:text-[#F5F5F5]">
                Project-Aware Studio Assistant
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-[#9CA3AF]">
                Ask {activeModel.shortName} to build new pages, redesign UI
                sections, fix bugs, explain code, or refactor files. Changes
                compile immediately into the live preview.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-slate-500 dark:text-[#9CA3AF]">
                Quick Prompts
              </div>
              {QUICK_AI_PROMPTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setInput(q);
                    textareaRef.current?.focus();
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#111318] hover:border-[#4285F4] text-xs text-slate-700 dark:text-[#F5F5F5] transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.role === "user") {
              const isEditingThis = editingMessageId === msg.id;
              const isCopied = copiedMessageId === msg.id;
              const copyText = msg.content.startsWith("$ ")
                ? msg.content.slice(2)
                : msg.content;

              return (
                <div key={msg.id} className="group flex items-start justify-end gap-1.5">
                  {!isEditingThis && (
                    <div className="mt-1.5 flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyText(msg.id, copyText)}
                        title={isCopied ? "Copied!" : "Copy this chat"}
                        aria-label="Copy chat message"
                        className={`p-1 rounded cursor-pointer ${
                          isCopied
                            ? "text-[#22C55E]"
                            : "text-slate-400 hover:text-[#4285F4]"
                        }`}
                      >
                        {isCopied ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={isGenerating || isRunningTerminal}
                        onClick={() => {
                          setEditingMessageId(msg.id);
                          setEditDraftText(msg.content);
                        }}
                        title="Edit this chat"
                        aria-label="Edit chat message"
                        className="p-1 rounded text-slate-400 hover:text-[#4285F4] disabled:opacity-40 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMessage(msg.id)}
                        title="Delete this chat message"
                        aria-label="Delete chat message"
                        className="p-1 rounded text-slate-400 hover:text-[#EF4444] cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <div
                    className={`rounded-xl border border-slate-200 dark:border-[#292E38] bg-slate-100 dark:bg-[#222630] px-3.5 py-2.5 space-y-2 ${
                      isEditingThis ? "w-full" : "max-w-[85%]"
                    }`}
                  >
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.attachments.map((att) =>
                          att.previewUrl ? (
                            <img
                              key={att.id}
                              src={att.previewUrl}
                              alt={att.name}
                              referrerPolicy="no-referrer"
                              className="h-20 rounded-md border border-slate-300 dark:border-[#292E38] object-cover"
                            />
                          ) : (
                            <span
                              key={att.id}
                              className="text-[11px] font-mono text-slate-600 dark:text-[#9CA3AF]"
                            >
                              {att.name}
                            </span>
                          )
                        )}
                      </div>
                    )}

                    {isEditingThis ? (
                      <div className="space-y-2">
                        <textarea
                          autoFocus
                          rows={3}
                          value={editDraftText}
                          onChange={(e) => setEditDraftText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setEditingMessageId(null);
                            } else if (
                              e.key === "Enter" &&
                              (e.metaKey || e.ctrlKey)
                            ) {
                              e.preventDefault();
                              const next = editDraftText.trim();
                              setEditingMessageId(null);
                              if (next) void onEditMessage(msg.id, next, true);
                            }
                          }}
                          className="w-full rounded-lg border border-[#4285F4] bg-white dark:bg-[#111318] p-2 text-xs leading-relaxed text-slate-900 dark:text-[#F5F5F5] focus:outline-none resize-y"
                        />
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingMessageId(null)}
                            className="px-2 py-1 rounded-md border border-slate-300 dark:border-[#292E38] text-[11px] text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!editDraftText.trim()}
                            onClick={() => {
                              const next = editDraftText.trim();
                              setEditingMessageId(null);
                              if (next) void onEditMessage(msg.id, next, false);
                            }}
                            className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-[#292E38] bg-white dark:bg-[#191C23] text-[11px] font-medium text-slate-800 dark:text-[#F5F5F5] hover:border-[#4285F4] disabled:opacity-40 cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            disabled={
                              !editDraftText.trim() ||
                              isGenerating ||
                              isRunningTerminal
                            }
                            onClick={() => {
                              const next = editDraftText.trim();
                              setEditingMessageId(null);
                              if (next) void onEditMessage(msg.id, next, true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#4285F4] hover:bg-[#3574E2] text-white text-[11px] font-medium disabled:opacity-40 cursor-pointer"
                          >
                            <ArrowUp className="w-3 h-3" />
                            <span>
                              {msg.content.startsWith("$ ") ||
                              editDraftText.trim().startsWith("$ ")
                                ? "Save & Run"
                                : "Save & Resend"}
                            </span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs sm:text-[13px] leading-relaxed text-slate-900 dark:text-[#F5F5F5] whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            const hasOps = Boolean(msg.operations && msg.operations.length > 0);
            const changeStatus = msg.changeState?.status ?? "accepted";
            const msgModelLabel = msg.githubAuthRequest
              ? "GitHub"
              : msg.terminal
              ? "Terminal"
              : STUDIO_MODELS.find((m) => m.id === msg.modelUsed)?.shortName ??
                msg.modelUsed ??
                "Gemini 4 Hydrogen";
            const hasSteps = Boolean(msg.agentSteps && msg.agentSteps.length > 0);
            const isStepsOpen =
              expandedSteps[msg.id] ?? Boolean(msg.streamingStatus);

            return (
              <div key={msg.id} className="group space-y-2.5">
                {msg.streamingStatus && (
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#4285F4]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>{msg.streamingStatus}</span>
                  </div>
                )}

                {hasSteps && msg.agentSteps && (
                  <div className="rounded-lg border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] overflow-hidden">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSteps((prev) => ({
                          ...prev,
                          [msg.id]: !isStepsOpen,
                        }))
                      }
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-medium text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-[#4285F4]" />
                        <span>
                          Agent Actions ({msg.agentSteps.length})
                        </span>
                      </span>
                      {isStepsOpen ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {isStepsOpen && (
                      <div className="px-3 py-2 border-t border-slate-200 dark:border-[#292E38] space-y-1.5">
                        {msg.agentSteps.map((step) => (
                          <div
                            key={step.id}
                            className="flex items-center justify-between gap-2 text-[11px] font-mono"
                          >
                            <span className="inline-flex items-center gap-1.5 min-w-0 text-slate-700 dark:text-[#F5F5F5]">
                              {step.status === "running" ? (
                                <Loader2 className="w-3 h-3 animate-spin text-[#4285F4] shrink-0" />
                              ) : step.status === "error" ? (
                                <X className="w-3 h-3 text-[#EF4444] shrink-0" />
                              ) : (
                                <Check className="w-3 h-3 text-[#22C55E] shrink-0" />
                              )}
                              <span className="truncate">{step.label}</span>
                            </span>
                            {step.detail && (
                              <span className="text-slate-400 dark:text-[#9CA3AF] shrink-0">
                                {step.detail}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {msg.thoughts && msg.thoughts.trim().length > 0 && (
                  <div className="rounded-lg border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] overflow-hidden">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedThoughts((prev) => ({
                          ...prev,
                          [msg.id]: !prev[msg.id],
                        }))
                      }
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-medium text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <BrainCircuit className="w-3.5 h-3.5" />
                        <span>Reasoning</span>
                      </span>
                      {expandedThoughts[msg.id] ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {expandedThoughts[msg.id] && (
                      <div className="px-3 pb-2.5 pt-1 border-t border-slate-200 dark:border-[#292E38] text-[11px] font-mono text-slate-500 dark:text-[#9CA3AF] whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {msg.thoughts}
                      </div>
                    )}
                  </div>
                )}

                {msg.error ? (
                  <div className="rounded-lg border border-[#EF4444]/50 bg-[#EF4444]/10 p-3 text-xs text-[#EF4444] space-y-2">
                    <p>{msg.error}</p>
                    {!isGenerating && (
                      <button
                        type="button"
                        onClick={() => {
                          const idx = messages.findIndex((m) => m.id === msg.id);
                          const prevUser = [...messages.slice(0, idx)]
                            .reverse()
                            .find((m) => m.role === "user");
                          if (prevUser) {
                            onSendPrompt(
                              prevUser.content,
                              prevUser.attachments ?? []
                            );
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#EF4444]/40 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[11px] font-medium text-[#EF4444] cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry Request</span>
                      </button>
                    )}
                  </div>
                ) : msg.githubAuthRequest ? (
                  <GitHubAuthCard
                    messageId={msg.id}
                    request={msg.githubAuthRequest}
                    githubUser={githubUser}
                    hasToken={Boolean(githubToken)}
                    isBusy={isRunningTerminal}
                    onAllow={onAllowGitHubAuth}
                    onDeny={onDenyGitHubAuth}
                  />
                ) : msg.terminal ? (
                  <div className="rounded-xl border border-slate-200 dark:border-[#292E38] bg-slate-950 overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-slate-800 flex items-center justify-between gap-2 text-[11px] font-mono">
                      <span className="inline-flex items-center gap-1.5 text-slate-300 truncate">
                        <TerminalIcon className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                        <span className="truncate">
                          {msg.terminal.command.split("\n")[0]}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 ${
                          msg.terminal.exitCode === 0
                            ? "text-[#22C55E]"
                            : "text-[#EF4444]"
                        }`}
                      >
                        exit {msg.terminal.exitCode}
                      </span>
                    </div>
                    <pre className="p-3 text-[11px] leading-relaxed font-mono text-slate-200 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                      {msg.terminal.output}
                    </pre>
                    {msg.terminal.changedPaths &&
                      msg.terminal.changedPaths.length > 0 && (
                        <div className="px-3 py-1.5 border-t border-slate-800 text-[11px] font-mono text-[#4285F4]">
                          Synced {msg.terminal.changedPaths.length} workspace{" "}
                          {msg.terminal.changedPaths.length === 1
                            ? "file"
                            : "files"}
                        </div>
                      )}
                  </div>
                ) : (
                  editingMessageId === msg.id ? (
                    <div className="rounded-xl border border-[#4285F4] bg-slate-50 dark:bg-[#111318] p-2.5 space-y-2">
                      <textarea
                        autoFocus
                        rows={4}
                        value={editDraftText}
                        onChange={(e) => setEditDraftText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditingMessageId(null);
                        }}
                        className="w-full rounded-lg border border-slate-300 dark:border-[#292E38] bg-white dark:bg-[#191C23] p-2 text-xs leading-relaxed text-slate-900 dark:text-[#F5F5F5] focus:outline-none resize-y"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingMessageId(null)}
                          className="px-2 py-1 rounded-md border border-slate-300 dark:border-[#292E38] text-[11px] text-slate-600 dark:text-[#9CA3AF] cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!editDraftText.trim()}
                          onClick={() => {
                            const next = editDraftText.trim();
                            setEditingMessageId(null);
                            if (next) void onEditMessage(msg.id, next, false);
                          }}
                          className="px-2.5 py-1 rounded-md bg-[#4285F4] hover:bg-[#3574E2] text-white text-[11px] font-medium disabled:opacity-40 cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[13px]">
                      <MarkdownRenderer content={msg.content} />
                    </div>
                  )
                )}

                {/* Proposed / Applied File Operations + Code Diffs */}
                {hasOps && msg.operations && (
                  <div className="rounded-xl border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#222630] p-3 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900 dark:text-[#F5F5F5]">
                        {msg.operations.length} File{" "}
                        {msg.operations.length === 1 ? "Change" : "Changes"}
                      </span>
                      <span
                        className={`text-[11px] font-medium ${
                          changeStatus === "accepted"
                            ? "text-[#22C55E]"
                            : changeStatus === "pending"
                            ? "text-[#4285F4]"
                            : "text-slate-500 dark:text-[#9CA3AF]"
                        }`}
                      >
                        {changeStatus === "accepted"
                          ? "Applied"
                          : changeStatus === "pending"
                          ? "Review Pending"
                          : changeStatus === "reverted"
                          ? "Reverted"
                          : "Rejected"}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {msg.operations.map((op) => {
                        const diffKey = `${msg.id}:${op.path}`;
                        const isDiffOpen = Boolean(expandedDiffs[diffKey]);
                        const prevContent =
                          msg.changeState?.previousFiles?.[op.path] ?? "";

                        return (
                          <div key={op.path} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23] px-2.5 py-1.5">
                              <button
                                type="button"
                                onClick={() => onSelectFile(op.path)}
                                className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-800 dark:text-[#F5F5F5] hover:text-[#4285F4] truncate cursor-pointer"
                              >
                                <FileCode2 className="w-3.5 h-3.5 shrink-0 text-[#4285F4]" />
                                <span className="truncate">{op.path}</span>
                              </button>
                              <div className="flex items-center gap-2 shrink-0 text-[11px]">
                                <span
                                  className={`uppercase font-mono ${
                                    op.action === "create"
                                      ? "text-[#22C55E]"
                                      : op.action === "delete"
                                      ? "text-[#EF4444]"
                                      : "text-[#4285F4]"
                                  }`}
                                >
                                  {op.action}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedDiffs((prev) => ({
                                      ...prev,
                                      [diffKey]: !prev[diffKey],
                                    }))
                                  }
                                  className="text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] underline cursor-pointer"
                                >
                                  {isDiffOpen ? "Hide diff" : "Diff"}
                                </button>
                              </div>
                            </div>

                            {isDiffOpen && (
                              <FileDiffBlock
                                op={op}
                                previousContent={prevContent}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Accept / Reject / Undo controls */}
                    <div className="flex items-center gap-2 pt-1">
                      {changeStatus === "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={() => onAcceptChanges(msg.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#22C55E] hover:bg-emerald-600 text-white text-xs font-medium cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accept Changes</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onRejectChanges(msg.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-[#292E38] text-slate-700 dark:text-[#F5F5F5] text-xs font-medium hover:bg-slate-100 dark:hover:bg-[#191C23] cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}

                      {changeStatus === "accepted" && (
                        <button
                          type="button"
                          onClick={() => onRevertChanges(msg.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-[#292E38] text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] text-xs cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Undo AI Modification</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Grounding Sources */}
                {msg.groundingSources && msg.groundingSources.length > 0 && (
                  <div className="space-y-1 text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                    <div className="font-medium">Sources</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {msg.groundingSources.map((src, i) => (
                        <a
                          key={`${src.uri}-${i}`}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#4285F4] hover:underline truncate max-w-[220px]"
                        >
                          {src.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-[#9CA3AF] tabular-nums">
                  <span>
                    {typeof msg.latencyMs === "number" ? (
                      <>
                        {msgModelLabel} · {(msg.latencyMs / 1000).toFixed(2)}s
                        {typeof msg.totalTokens === "number"
                          ? ` · ${msg.totalTokens} tokens`
                          : ""}
                      </>
                    ) : (
                      msgModelLabel
                    )}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {!msg.streamingStatus && (
                      <button
                        type="button"
                        onClick={() => {
                          const textToCopy = msg.terminal
                            ? `$ ${msg.terminal.command}\n${msg.terminal.output}`
                            : msg.githubAuthRequest
                            ? `$ ${msg.githubAuthRequest.command}`
                            : msg.error
                            ? msg.error
                            : msg.content;
                          void handleCopyText(msg.id, textToCopy);
                        }}
                        title={
                          copiedMessageId === msg.id
                            ? "Copied!"
                            : "Copy this message"
                        }
                        aria-label="Copy assistant message"
                        className={`inline-flex items-center gap-1 p-1 rounded cursor-pointer ${
                          copiedMessageId === msg.id
                            ? "text-[#22C55E] opacity-100"
                            : "text-slate-400 opacity-60 group-hover:opacity-100 hover:text-[#4285F4]"
                        }`}
                      >
                        {copiedMessageId === msg.id ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span className="text-[10px]">Copied</span>
                          </>
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}

                    {!msg.streamingStatus &&
                      !msg.terminal &&
                      !msg.githubAuthRequest &&
                      !msg.error && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMessageId(msg.id);
                            setEditDraftText(msg.content);
                          }}
                          title="Edit this message"
                          aria-label="Edit assistant message"
                          className="inline-flex items-center gap-1 p-1 rounded text-slate-400 opacity-60 group-hover:opacity-100 hover:text-[#4285F4] cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}

                    <button
                      type="button"
                      onClick={() => onDeleteMessage(msg.id)}
                      title="Delete this chat message"
                      aria-label="Delete assistant message"
                      className="inline-flex items-center gap-1 p-1 rounded text-slate-400 opacity-60 group-hover:opacity-100 hover:text-[#EF4444] cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {(isGenerating || isRunningTerminal) && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#9CA3AF]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4285F4]" />
            <span>
              {isRunningTerminal
                ? "Running terminal command in project workspace..."
                : "Analyzing project files & generating code..."}
            </span>
          </div>
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* Prompt Composer & Extensions Field Box */}
      <div className="p-3 border-t border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23] space-y-2 shrink-0">
        {openExtensionTab && (
          <ExtensionsFieldBox
            activeTab={openExtensionTab}
            onSelectTab={setOpenExtensionTab}
            onClose={() => setOpenExtensionTab(null)}
            project={project}
            plugins={plugins}
            skills={skills}
            apiConnectors={apiConnectors}
            githubToken={githubToken}
            githubUser={githubUser}
            githubRepos={githubRepos}
            onTogglePlugin={onTogglePlugin}
            onAddCustomPlugin={onAddCustomPlugin}
            onDeleteCustomPlugin={onDeleteCustomPlugin}
            onRunPluginNow={(plugin) => {
              if (!project.enabledPluginIds.includes(plugin.id)) {
                onTogglePlugin(plugin.id);
              }
              setOpenExtensionTab(null);
              onSendPrompt(
                `Run the "${plugin.name}" plugin across the current project and apply any needed improvements.`,
                []
              );
            }}
            onToggleSkill={onToggleSkill}
            onAddCustomSkill={onAddCustomSkill}
            onDeleteCustomSkill={onDeleteCustomSkill}
            onApplySkillPrompt={(skill) => {
              if (!project.enabledSkillIds.includes(skill.id)) {
                onToggleSkill(skill.id);
              }
              setOpenExtensionTab(null);
              setInput((prev) =>
                prev.trim()
                  ? prev
                  : `Apply the "${skill.name}" skill to enhance the current project: `
              );
              textareaRef.current?.focus();
            }}
            onToggleSearch={onToggleSearch}
            onToggleUrlContext={onToggleUrlContext}
            onAddApiConnector={onAddApiConnector}
            onToggleApiConnector={onToggleApiConnector}
            onDeleteApiConnector={onDeleteApiConnector}
            onTestApiConnector={onTestApiConnector}
            onConnectGitHubToken={onConnectGitHubToken}
            onDisconnectGitHub={onDisconnectGitHub}
            onImportGitHubRepo={onImportGitHubRepo}
            onPushGitHubRepo={onPushGitHubRepo}
          />
        )}

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#222630] text-[11px] text-slate-800 dark:text-[#F5F5F5]"
              >
                {att.previewUrl && (
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    referrerPolicy="no-referrer"
                    className="w-4 h-4 rounded object-cover"
                  />
                )}
                <span className="truncate max-w-[110px]">{att.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((a) => a.id !== att.id))
                  }
                  className="text-slate-400 hover:text-[#EF4444] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {composerMode === "chat" &&
          looksLikeShellScript &&
          attachments.length === 0 && (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-[#22C55E]/40 bg-[#22C55E]/10 text-[11px]">
              <span className="text-slate-700 dark:text-[#F5F5F5] truncate">
                Shell / Git commands detected
              </span>
              <button
                type="button"
                onClick={() => executeTerminal(input)}
                disabled={isGenerating || isRunningTerminal}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#22C55E] hover:bg-emerald-600 text-white font-medium cursor-pointer shrink-0"
              >
                <TerminalIcon className="w-3 h-3" />
                <span>Run in Terminal</span>
              </button>
            </div>
          )}

        <div
          className={`rounded-xl border bg-slate-50 dark:bg-[#111318] p-2 transition-colors ${
            composerMode === "terminal"
              ? "border-[#22C55E]/60 focus-within:border-[#22C55E]"
              : "border-slate-200 dark:border-[#292E38] focus-within:border-[#4285F4]"
          }`}
        >
          {composerMode === "terminal" && (
            <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-200 dark:border-[#292E38] text-[11px] font-mono">
              <span className="inline-flex items-center gap-1.5 text-[#22C55E]">
                <TerminalIcon className="w-3 h-3" />
                <span>~/projects/{project.name}</span>
              </span>
              <button
                type="button"
                onClick={() => setComposerMode("chat")}
                className="text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] cursor-pointer"
              >
                AI Chat Mode
              </button>
            </div>
          )}

          <textarea
            ref={textareaRef}
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
                return;
              }
              if (
                composerMode === "terminal" &&
                !input.includes("\n") &&
                terminalCmdHistory.length > 0
              ) {
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  const next = Math.min(
                    historyCursor + 1,
                    terminalCmdHistory.length - 1
                  );
                  setHistoryCursor(next);
                  setInput(terminalCmdHistory[next]);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  const next = historyCursor - 1;
                  if (next < 0) {
                    setHistoryCursor(-1);
                    setInput("");
                  } else {
                    setHistoryCursor(next);
                    setInput(terminalCmdHistory[next]);
                  }
                }
              }
            }}
            placeholder={
              composerMode === "terminal"
                ? 'Run git or shell commands (Enter to run, Shift+Enter for multi-line)...\ne.g. git init && git add . && git commit -m "Initial commit"'
                : `Ask ${activeModel.shortName} to build/edit, or prefix with ! for terminal...`
            }
            className={`w-full bg-transparent leading-relaxed text-slate-900 dark:text-[#F5F5F5] placeholder:text-slate-400 dark:placeholder:text-[#9CA3AF] focus:outline-none resize-none ${
              composerMode === "terminal"
                ? "font-mono text-xs"
                : "text-[13px]"
            }`}
          />

          <div className="flex items-center justify-between pt-1.5">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.txt,.md,.json,.csv,.ts,.tsx,.js,.jsx,.css,.html,.pdf"
                onChange={handleFilePick}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach image or reference file"
                aria-label="Attach file"
                className="p-1.5 rounded-lg text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] hover:bg-slate-200/70 dark:hover:bg-[#222630] transition-colors cursor-pointer"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() =>
                  setOpenExtensionTab((prev) =>
                    prev === "plugins" ? null : "plugins"
                  )
                }
                title={`Plugins (${project.enabledPluginIds.length} active)`}
                aria-label="Plugins"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  openExtensionTab === "plugins"
                    ? "bg-[#4285F4]/20 text-[#4285F4]"
                    : project.enabledPluginIds.length > 0
                    ? "text-[#4285F4] hover:bg-slate-200/70 dark:hover:bg-[#222630]"
                    : "text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] hover:bg-slate-200/70 dark:hover:bg-[#222630]"
                }`}
              >
                <Puzzle className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() =>
                  setOpenExtensionTab((prev) =>
                    prev === "connectors" ? null : "connectors"
                  )
                }
                title={
                  githubUser
                    ? `Connectors · GitHub connected (@${githubUser.login})`
                    : "Connectors (GitHub, Search, URL, REST API)"
                }
                aria-label="Connectors"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  openExtensionTab === "connectors"
                    ? "bg-[#4285F4]/20 text-[#4285F4]"
                    : githubUser || project.githubRepo
                    ? "text-[#22C55E] hover:bg-slate-200/70 dark:hover:bg-[#222630]"
                    : project.useSearch ||
                      project.useUrlContext ||
                      apiConnectors.some((c) => c.enabled)
                    ? "text-[#4285F4] hover:bg-slate-200/70 dark:hover:bg-[#222630]"
                    : "text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] hover:bg-slate-200/70 dark:hover:bg-[#222630]"
                }`}
              >
                <Plug className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() =>
                  setOpenExtensionTab((prev) =>
                    prev === "skills" ? null : "skills"
                  )
                }
                title={`Skills (${project.enabledSkillIds.length} active)`}
                aria-label="Skills"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  openExtensionTab === "skills"
                    ? "bg-[#4285F4]/20 text-[#4285F4]"
                    : project.enabledSkillIds.length > 0
                    ? "text-[#4285F4] hover:bg-slate-200/70 dark:hover:bg-[#222630]"
                    : "text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] hover:bg-slate-200/70 dark:hover:bg-[#222630]"
                }`}
              >
                <Wand2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setComposerMode((m) =>
                    m === "terminal" ? "chat" : "terminal"
                  );
                  textareaRef.current?.focus();
                }}
                title={
                  composerMode === "terminal"
                    ? "Switch back to AI Chat mode"
                    : "Switch to Terminal mode (run git / shell commands)"
                }
                aria-label="Toggle Terminal mode"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  composerMode === "terminal"
                    ? "bg-[#22C55E]/20 text-[#22C55E]"
                    : "text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] hover:bg-slate-200/70 dark:hover:bg-[#222630]"
                }`}
              >
                <TerminalIcon className="w-4 h-4" />
              </button>

              {composerMode === "terminal" ? (
                <span className="ml-1 text-[11px] text-[#22C55E] font-mono">
                  SH
                </span>
              ) : (
                <div className="flex items-center gap-0.5">
                  <select
                    aria-label="Active AI model"
                    title="Switch active AI model"
                    value={project.model}
                    onChange={(e) =>
                      onChangeModel(e.target.value as StudioModelId)
                    }
                    className="md:hidden ml-0.5 max-w-[104px] truncate rounded bg-transparent px-1 py-0.5 text-[11px] font-medium text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] focus:outline-none cursor-pointer"
                  >
                    {STUDIO_MODELS.map((m) => (
                      <option
                        key={m.id}
                        value={m.id}
                        className="bg-white dark:bg-[#191C23] text-slate-900 dark:text-[#F5F5F5]"
                      >
                        {m.shortName}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Reasoning speed"
                    title="Reasoning depth (LOW is fastest)"
                    value={project.thinkingLevel}
                    onChange={(e) =>
                      onChangeThinkingLevel(e.target.value as ThinkingDepth)
                    }
                    className="ml-0.5 rounded bg-transparent px-1 py-0.5 text-[11px] font-mono text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] focus:outline-none cursor-pointer"
                  >
                    {activeModel.supportedThinkingLevels.map((lvl) => (
                      <option
                        key={lvl}
                        value={lvl}
                        className="bg-white dark:bg-[#191C23] text-slate-900 dark:text-[#F5F5F5]"
                      >
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {isGenerating ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EF4444] hover:bg-red-600 text-white text-xs font-medium cursor-pointer"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            ) : composerMode === "terminal" ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!input.trim() || isRunningTerminal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22C55E] hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{isRunningTerminal ? "Running..." : "Run"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  (!input.trim() && attachments.length === 0) ||
                  isRunningTerminal
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4285F4] hover:bg-[#3574E2] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
