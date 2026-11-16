import React, { useEffect, useState } from "react";
import {
  Check,
  ExternalLink,
  GitBranch,
  Globe,
  Link2,
  Loader2,
  Play,
  Plug,
  Plus,
  Puzzle,
  RefreshCw,
  Trash2,
  UploadCloud,
  Wand2,
  X,
} from "lucide-react";
import {
  ApiConnector,
  GitHubRepoSummary,
  GitHubUser,
  StudioPlugin,
  StudioProject,
  StudioSkill,
} from "../types/studio.ts";

export type ExtensionTab = "plugins" | "connectors" | "skills";

interface ExtensionsFieldBoxProps {
  activeTab: ExtensionTab;
  onSelectTab: (tab: ExtensionTab) => void;
  onClose: () => void;
  project: StudioProject;
  plugins: StudioPlugin[];
  skills: StudioSkill[];
  apiConnectors: ApiConnector[];
  githubToken: string;
  githubUser: GitHubUser | null;
  githubRepos: GitHubRepoSummary[];
  onTogglePlugin: (id: string) => void;
  onAddCustomPlugin: (plugin: Omit<StudioPlugin, "id" | "isCustom">) => void;
  onDeleteCustomPlugin: (id: string) => void;
  onRunPluginNow: (plugin: StudioPlugin) => void;
  onToggleSkill: (id: string) => void;
  onAddCustomSkill: (skill: Omit<StudioSkill, "id" | "isCustom">) => void;
  onDeleteCustomSkill: (id: string) => void;
  onApplySkillPrompt: (skill: StudioSkill) => void;
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
}

export const ExtensionsFieldBox: React.FC<ExtensionsFieldBoxProps> = ({
  activeTab,
  onSelectTab,
  onClose,
  project,
  plugins,
  skills,
  apiConnectors,
  githubToken,
  githubUser,
  githubRepos,
  onTogglePlugin,
  onAddCustomPlugin,
  onDeleteCustomPlugin,
  onRunPluginNow,
  onToggleSkill,
  onAddCustomSkill,
  onDeleteCustomSkill,
  onApplySkillPrompt,
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
}) => {
  // Custom plugin form
  const [addingPlugin, setAddingPlugin] = useState(false);
  const [pluginName, setPluginName] = useState("");
  const [pluginDesc, setPluginDesc] = useState("");
  const [pluginInstruction, setPluginInstruction] = useState("");

  // Custom skill form
  const [addingSkill, setAddingSkill] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [skillDesc, setSkillDesc] = useState("");
  const [skillInstructions, setSkillInstructions] = useState("");

  // GitHub state
  const [patInput, setPatInput] = useState("");
  const [ghBusy, setGhBusy] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);
  const [ghSuccess, setGhSuccess] = useState<string | null>(null);
  const [repoInput, setRepoInput] = useState(
    project.githubRepo
      ? `${project.githubRepo.owner}/${project.githubRepo.repo}`
      : ""
  );
  const [branchInput, setBranchInput] = useState(
    project.githubRepo?.branch ?? ""
  );
  const [commitMsg, setCommitMsg] = useState("Update project from AI Studio");
  const [lastCommitUrl, setLastCommitUrl] = useState<string | null>(
    project.githubRepo?.lastCommitUrl ?? null
  );
  const [oauthConfigured, setOauthConfigured] = useState(false);

  // Custom API Connector state
  const [addingApi, setAddingApi] = useState(false);
  const [apiName, setApiName] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiMethod, setApiMethod] = useState<"GET" | "POST">("GET");
  const [apiAuth, setApiAuth] = useState("");
  const [testingApiId, setTestingApiId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/github/oauth/config")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => {
        setOauthConfigured(Boolean(d.configured));
      })
      .catch(() => {});
  }, []);

  const handleGitHubOAuth = async () => {
    setGhError(null);
    try {
      const res = await fetch("/api/github/oauth/url");
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "OAuth unavailable.");
      }
      window.open(data.url, "github_oauth", "width=600,height=720");
    } catch (err) {
      setGhError(err instanceof Error ? err.message : "OAuth error.");
    }
  };

  const handleConnectToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patInput.trim()) return;
    setGhError(null);
    setGhSuccess(null);
    setGhBusy(true);
    try {
      await onConnectGitHubToken(patInput.trim());
      setPatInput("");
      setGhSuccess("Connected to GitHub.");
    } catch (err) {
      setGhError(err instanceof Error ? err.message : "Connection failed.");
    } finally {
      setGhBusy(false);
    }
  };

  const handleImportRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoInput.trim()) return;
    setGhError(null);
    setGhSuccess(null);
    setGhBusy(true);
    try {
      await onImportGitHubRepo(repoInput.trim(), branchInput.trim() || undefined);
      setGhSuccess(`Imported ${repoInput.trim()} into workspace.`);
    } catch (err) {
      setGhError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setGhBusy(false);
    }
  };

  const handlePushRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    setGhError(null);
    setGhSuccess(null);
    setGhBusy(true);
    try {
      const res = await onPushGitHubRepo(commitMsg);
      setLastCommitUrl(res.commitUrl);
      setGhSuccess("Pushed changes to GitHub.");
    } catch (err) {
      setGhError(err instanceof Error ? err.message : "Push failed.");
    } finally {
      setGhBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] overflow-hidden shadow-lg">
      {/* Header Tabs */}
      <div className="px-2.5 py-2 border-b border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSelectTab("plugins")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === "plugins"
                ? "bg-[#4285F4]/15 text-[#4285F4]"
                : "text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5]"
            }`}
          >
            <Puzzle className="w-3.5 h-3.5" />
            <span>Plugins ({project.enabledPluginIds.length})</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab("connectors")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === "connectors"
                ? "bg-[#4285F4]/15 text-[#4285F4]"
                : "text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5]"
            }`}
          >
            <Plug className="w-3.5 h-3.5" />
            <span>Connectors</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectTab("skills")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === "skills"
                ? "bg-[#4285F4]/15 text-[#4285F4]"
                : "text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5]"
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Skills ({project.enabledSkillIds.length})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close extensions panel"
          className="p-1 rounded text-slate-400 hover:text-slate-900 dark:hover:text-[#F5F5F5] cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-3 max-h-80 overflow-y-auto space-y-3 text-xs">
        {/* PLUGINS TAB */}
        {activeTab === "plugins" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                Active plugins enforce studio rules and audits during builds.
              </span>
              <button
                type="button"
                onClick={() => setAddingPlugin((p) => !p)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4285F4] hover:underline cursor-pointer shrink-0"
              >
                <Plus className="w-3 h-3" />
                <span>Add Plugin</span>
              </button>
            </div>

            {addingPlugin && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!pluginName.trim() || !pluginInstruction.trim()) return;
                  onAddCustomPlugin({
                    name: pluginName.trim(),
                    description: pluginDesc.trim() || "Custom studio plugin",
                    instruction: pluginInstruction.trim(),
                  });
                  setPluginName("");
                  setPluginDesc("");
                  setPluginInstruction("");
                  setAddingPlugin(false);
                }}
                className="p-2.5 rounded-lg border border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23] space-y-2"
              >
                <input
                  type="text"
                  value={pluginName}
                  onChange={(e) => setPluginName(e.target.value)}
                  placeholder="Plugin name (e.g. Tailwind Strict)"
                  required
                  className="w-full rounded border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                />
                <input
                  type="text"
                  value={pluginDesc}
                  onChange={(e) => setPluginDesc(e.target.value)}
                  placeholder="Short description"
                  className="w-full rounded border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                />
                <textarea
                  rows={2}
                  value={pluginInstruction}
                  onChange={(e) => setPluginInstruction(e.target.value)}
                  placeholder="Plugin rule / behavior injected when active..."
                  required
                  className="w-full rounded border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] p-2 text-xs text-slate-900 dark:text-[#F5F5F5]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddingPlugin(false)}
                    className="text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded bg-[#4285F4] text-white font-medium cursor-pointer"
                  >
                    Save Plugin
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-1.5">
              {plugins.map((plugin) => {
                const enabled = project.enabledPluginIds.includes(plugin.id);
                return (
                  <div
                    key={plugin.id}
                    className="flex items-start justify-between gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23]"
                  >
                    <label className="flex items-start gap-2.5 cursor-pointer min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => onTogglePlugin(plugin.id)}
                        className="mt-0.5 h-3.5 w-3.5 rounded text-[#4285F4]"
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 dark:text-[#F5F5F5]">
                          {plugin.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                          {plugin.description}
                        </div>
                      </div>
                    </label>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onRunPluginNow(plugin)}
                        title="Run this plugin on current project"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-[#292E38] text-[11px] text-slate-700 dark:text-[#F5F5F5] hover:border-[#4285F4] cursor-pointer"
                      >
                        <Play className="w-2.5 h-2.5" />
                        <span>Run</span>
                      </button>
                      {plugin.isCustom && (
                        <button
                          type="button"
                          onClick={() => onDeleteCustomPlugin(plugin.id)}
                          aria-label="Delete plugin"
                          className="p-1 text-slate-400 hover:text-[#EF4444] cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CONNECTORS TAB */}
        {activeTab === "connectors" && (
          <div className="space-y-3">
            {/* GitHub Connector */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <GitBranch className="w-4 h-4 text-[#4285F4] shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-[#F5F5F5]">
                      GitHub Connector
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF] truncate">
                      {githubUser
                        ? `Connected as @${githubUser.login}`
                        : "Import public repos or connect token to browse & push"}
                    </div>
                  </div>
                </div>

                {githubUser && (
                  <button
                    type="button"
                    onClick={onDisconnectGitHub}
                    className="text-[11px] text-slate-500 hover:text-[#EF4444] cursor-pointer shrink-0"
                  >
                    Disconnect
                  </button>
                )}
              </div>

              {!githubUser ? (
                <div className="space-y-2 pt-1">
                  <form onSubmit={handleConnectToken} className="flex gap-1.5">
                    <input
                      type="password"
                      value={patInput}
                      onChange={(e) => setPatInput(e.target.value)}
                      placeholder="GitHub Personal Access Token (ghp_...)"
                      className="flex-1 rounded border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                    />
                    <button
                      type="submit"
                      disabled={ghBusy || !patInput.trim()}
                      className="px-2.5 py-1.5 rounded bg-[#4285F4] hover:bg-[#3574E2] disabled:opacity-40 text-white font-medium cursor-pointer shrink-0"
                    >
                      {ghBusy ? "Connecting..." : "Connect"}
                    </button>
                  </form>

                  {oauthConfigured && (
                    <button
                      type="button"
                      onClick={handleGitHubOAuth}
                      className="w-full py-1.5 rounded border border-slate-200 dark:border-[#292E38] text-xs font-medium text-slate-800 dark:text-[#F5F5F5] hover:bg-slate-50 dark:hover:bg-[#222630] cursor-pointer"
                    >
                      Continue with GitHub OAuth
                    </button>
                  )}
                </div>
              ) : (
                githubRepos.length > 0 && (
                  <div className="space-y-1">
                    <label className="block text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                      Your Repositories
                    </label>
                    <select
                      value=""
                      onChange={(e) => {
                        const selected = githubRepos.find(
                          (r) => r.fullName === e.target.value
                        );
                        if (selected) {
                          setRepoInput(selected.fullName);
                          setBranchInput(selected.defaultBranch);
                        }
                      }}
                      className="w-full rounded border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                    >
                      <option value="">Select a repository to import...</option>
                      {githubRepos.map((r) => (
                        <option key={r.fullName} value={r.fullName}>
                          {r.fullName} ({r.defaultBranch})
                          {r.private ? " · Private" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              )}

              {/* Import Any Repo */}
              <form
                onSubmit={handleImportRepo}
                className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-[#292E38]"
              >
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    placeholder="owner/repo or https://github.com/owner/repo"
                    className="flex-1 rounded border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-[#F5F5F5]"
                  />
                  <input
                    type="text"
                    value={branchInput}
                    onChange={(e) => setBranchInput(e.target.value)}
                    placeholder="branch"
                    className="w-20 rounded border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-2 py-1.5 text-xs font-mono text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={ghBusy || !repoInput.trim()}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#222630] hover:border-[#4285F4] text-xs font-medium text-slate-800 dark:text-[#F5F5F5] disabled:opacity-40 cursor-pointer"
                >
                  {ghBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>Import Repository to Workspace</span>
                </button>
              </form>

              {/* Push to Linked Repo */}
              {project.githubRepo && githubToken && (
                <form
                  onSubmit={handlePushRepo}
                  className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-[#292E38]"
                >
                  <div className="text-[11px] font-medium text-slate-700 dark:text-[#F5F5F5]">
                    Linked: {project.githubRepo.owner}/{project.githubRepo.repo} (
                    {project.githubRepo.branch})
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={commitMsg}
                      onChange={(e) => setCommitMsg(e.target.value)}
                      placeholder="Commit message..."
                      className="flex-1 rounded border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                    />
                    <button
                      type="submit"
                      disabled={ghBusy}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#22C55E] hover:bg-emerald-600 text-white font-medium cursor-pointer shrink-0"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Push</span>
                    </button>
                  </div>
                </form>
              )}

              {ghError && (
                <div className="text-[11px] text-[#EF4444]">{ghError}</div>
              )}
              {ghSuccess && (
                <div className="flex items-center justify-between gap-2 text-[11px] text-[#22C55E]">
                  <span className="inline-flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {ghSuccess}
                  </span>
                  {lastCommitUrl && (
                    <a
                      href={lastCommitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#4285F4] hover:underline"
                    >
                      <span>View Commit</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Built-in Web Connectors */}
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23] space-y-2">
              <div className="font-semibold text-slate-900 dark:text-[#F5F5F5]">
                Web & Grounding Connectors
              </div>
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="inline-flex items-center gap-2 text-slate-700 dark:text-[#F5F5F5]">
                  <Globe className="w-3.5 h-3.5 text-[#4285F4]" />
                  <span>Google Search Grounding</span>
                </span>
                <input
                  type="checkbox"
                  checked={project.useSearch}
                  onChange={onToggleSearch}
                  className="h-3.5 w-3.5 rounded text-[#4285F4]"
                />
              </label>

              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="inline-flex items-center gap-2 text-slate-700 dark:text-[#F5F5F5]">
                  <Link2 className="w-3.5 h-3.5 text-[#4285F4]" />
                  <span>URL Context Reader</span>
                </span>
                <input
                  type="checkbox"
                  checked={project.useUrlContext}
                  onChange={onToggleUrlContext}
                  className="h-3.5 w-3.5 rounded text-[#4285F4]"
                />
              </label>
            </div>

            {/* Custom REST / API Connectors */}
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-[#F5F5F5]">
                  REST / API Connectors
                </span>
                <button
                  type="button"
                  onClick={() => setAddingApi((p) => !p)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4285F4] hover:underline cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add API</span>
                </button>
              </div>

              {addingApi && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!apiName.trim() || !apiUrl.trim()) return;
                    onAddApiConnector({
                      name: apiName.trim(),
                      url: apiUrl.trim(),
                      method: apiMethod,
                      authHeader: apiAuth.trim() || undefined,
                      enabled: true,
                    });
                    setApiName("");
                    setApiUrl("");
                    setApiAuth("");
                    setAddingApi(false);
                  }}
                  className="space-y-1.5 pt-1"
                >
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={apiName}
                      onChange={(e) => setApiName(e.target.value)}
                      placeholder="Name (e.g. Products API)"
                      required
                      className="flex-1 rounded border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-2 py-1 text-xs"
                    />
                    <select
                      value={apiMethod}
                      onChange={(e) =>
                        setApiMethod(e.target.value as "GET" | "POST")
                      }
                      className="rounded border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-2 py-1 text-xs"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                  </div>
                  <input
                    type="url"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://api.example.com/v1/items"
                    required
                    className="w-full rounded border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-2 py-1 text-xs font-mono"
                  />
                  <input
                    type="password"
                    value={apiAuth}
                    onChange={(e) => setApiAuth(e.target.value)}
                    placeholder="Optional Bearer token header"
                    className="w-full rounded border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-2 py-1 text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAddingApi(false)}
                      className="text-slate-500 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-2.5 py-1 rounded bg-[#4285F4] text-white font-medium cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </form>
              )}

              {apiConnectors.length === 0 ? (
                <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                  Connect external REST endpoints so AI can inspect live JSON responses.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {apiConnectors.map((conn) => (
                    <div
                      key={conn.id}
                      className="flex items-center justify-between gap-2 rounded border border-slate-200 dark:border-[#292E38] px-2 py-1.5"
                    >
                      <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={conn.enabled}
                          onChange={() => onToggleApiConnector(conn.id)}
                          className="h-3.5 w-3.5 rounded text-[#4285F4]"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 dark:text-[#F5F5F5] truncate">
                            {conn.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 dark:text-[#9CA3AF] truncate">
                            {conn.method} {conn.url}
                            {conn.lastStatus ? ` · ${conn.lastStatus}` : ""}
                          </div>
                        </div>
                      </label>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            setTestingApiId(conn.id);
                            await onTestApiConnector(conn.id);
                            setTestingApiId(null);
                          }}
                          className="px-2 py-0.5 rounded border border-slate-200 dark:border-[#292E38] text-[10px] hover:border-[#4285F4] cursor-pointer"
                        >
                          {testingApiId === conn.id ? "..." : "Fetch"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteApiConnector(conn.id)}
                          className="p-1 text-slate-400 hover:text-[#EF4444] cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SKILLS TAB */}
        {activeTab === "skills" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                Enable specialized engineering & design skills for the assistant.
              </span>
              <button
                type="button"
                onClick={() => setAddingSkill((p) => !p)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4285F4] hover:underline cursor-pointer shrink-0"
              >
                <Plus className="w-3 h-3" />
                <span>New Skill</span>
              </button>
            </div>

            {addingSkill && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!skillName.trim() || !skillInstructions.trim()) return;
                  onAddCustomSkill({
                    name: skillName.trim(),
                    description: skillDesc.trim() || "Custom studio skill",
                    instructions: skillInstructions.trim(),
                  });
                  setSkillName("");
                  setSkillDesc("");
                  setSkillInstructions("");
                  setAddingSkill(false);
                }}
                className="p-2.5 rounded-lg border border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23] space-y-2"
              >
                <input
                  type="text"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  placeholder="Skill name (e.g. E-Commerce Checkout)"
                  required
                  className="w-full rounded border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                />
                <input
                  type="text"
                  value={skillDesc}
                  onChange={(e) => setSkillDesc(e.target.value)}
                  placeholder="Short description"
                  className="w-full rounded border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                />
                <textarea
                  rows={3}
                  value={skillInstructions}
                  onChange={(e) => setSkillInstructions(e.target.value)}
                  placeholder="Detailed skill instructions for the AI..."
                  required
                  className="w-full rounded border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] p-2 text-xs text-slate-900 dark:text-[#F5F5F5]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setAddingSkill(false)}
                    className="text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-1 rounded bg-[#4285F4] text-white font-medium cursor-pointer"
                  >
                    Save Skill
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-1.5">
              {skills.map((skill) => {
                const enabled = project.enabledSkillIds.includes(skill.id);
                return (
                  <div
                    key={skill.id}
                    className="flex items-start justify-between gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23]"
                  >
                    <label className="flex items-start gap-2.5 cursor-pointer min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => onToggleSkill(skill.id)}
                        className="mt-0.5 h-3.5 w-3.5 rounded text-[#4285F4]"
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 dark:text-[#F5F5F5]">
                          {skill.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
                          {skill.description}
                        </div>
                      </div>
                    </label>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onApplySkillPrompt(skill)}
                        title="Use this skill in prompt"
                        className="px-2 py-1 rounded border border-slate-200 dark:border-[#292E38] text-[11px] text-slate-700 dark:text-[#F5F5F5] hover:border-[#4285F4] cursor-pointer"
                      >
                        Use
                      </button>
                      {skill.isCustom && (
                        <button
                          type="button"
                          onClick={() => onDeleteCustomSkill(skill.id)}
                          aria-label="Delete skill"
                          className="p-1 text-slate-400 hover:text-[#EF4444] cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
