export type StudioModelId =
  | "gemini-4-hydrogen"
  | "gemini-3.5-flash-lite"
  | "gemini-3.1-flash-lite"
  | "claude-opus-5-5"
  | "gpt-5.5";

export type ThinkingDepth = "MINIMAL" | "LOW" | "MEDIUM" | "HIGH" | "XHIGH";

export type WorkspaceViewMode = "preview" | "code" | "split";

export type BottomPanelTab =
  | "problems"
  | "console"
  | "build"
  | "errors"
  | "terminal";

export interface AttachmentItem {
  id: string;
  name: string;
  mimeType: string;
  dataBase64: string;
  sizeBytes: number;
  previewUrl?: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface FileOperation {
  action: "create" | "update" | "delete";
  path: string;
  content?: string;
}

export interface AppliedSnapshot {
  previousFiles: Record<string, string>;
  status: "pending" | "accepted" | "rejected" | "reverted";
}

export interface TerminalMessagePayload {
  command: string;
  exitCode: number;
  output: string;
  changedPaths?: string[];
}

export interface AgentStep {
  id: string;
  toolName: string;
  label: string;
  status: "running" | "done" | "error";
  detail?: string;
}

export interface GitHubAuthRequest {
  id: string;
  command: string;
  targetRepo?: string;
  actionLabel: string;
  status: "pending" | "allowed" | "denied";
  resolvedAt?: number;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  summary?: string;
  thoughts?: string;
  attachments?: AttachmentItem[];
  operations?: FileOperation[];
  changeState?: AppliedSnapshot;
  groundingSources?: GroundingSource[];
  terminal?: TerminalMessagePayload;
  agentSteps?: AgentStep[];
  githubAuthRequest?: GitHubAuthRequest;
  streamingStatus?: string;
  modelUsed?: StudioModelId;
  createdAt: number;
  latencyMs?: number;
  totalTokens?: number;
  error?: string;
}

export interface ConversationThread {
  id: string;
  title: string;
  messages: AssistantMessage[];
  updatedAt: number;
}

export interface ProjectVersion {
  id: string;
  label: string;
  createdAt: number;
  files: Record<string, string>;
  changedFilesCount: number;
}

export interface StudioPlugin {
  id: string;
  name: string;
  description: string;
  instruction: string;
  isCustom?: boolean;
}

export interface StudioSkill {
  id: string;
  name: string;
  description: string;
  instructions: string;
  isCustom?: boolean;
}

export interface ApiConnector {
  id: string;
  name: string;
  url: string;
  method: "GET" | "POST";
  authHeader?: string;
  enabled: boolean;
  lastResponsePreview?: string;
  lastStatus?: number;
}

export interface GitHubUser {
  login: string;
  name?: string;
  avatarUrl?: string;
}

export interface GitHubRepoSummary {
  fullName: string;
  defaultBranch: string;
  private: boolean;
  description?: string;
}

export interface LinkedGitHubRepo {
  owner: string;
  repo: string;
  branch: string;
  lastSyncedAt?: number;
  lastCommitUrl?: string;
}

export interface StudioProject {
  id: string;
  name: string;
  files: Record<string, string>;
  openTabs: string[];
  activeFile: string;
  conversations: ConversationThread[];
  activeConversationId: string;
  versions: ProjectVersion[];
  model: StudioModelId;
  thinkingLevel: ThinkingDepth;
  useSearch: boolean;
  useUrlContext: boolean;
  autoApplyChanges: boolean;
  fallbackOnQuota?: boolean;
  systemInstruction: string;
  enabledPluginIds: string[];
  enabledSkillIds: string[];
  githubRepo?: LinkedGitHubRepo | null;
  updatedAt: number;
}

export interface BundleDiagnostic {
  id: string;
  severity: "error" | "warning";
  file?: string;
  line?: number;
  column?: number;
  message: string;
}

export interface ConsoleEntry {
  id: string;
  level: "log" | "info" | "warn" | "error";
  message: string;
  timestamp: number;
}

export interface BuildLogEntry {
  id: string;
  message: string;
  durationMs?: number;
  status: "success" | "error" | "info";
  timestamp: number;
}

export interface DevicePreset {
  id: "desktop" | "laptop" | "tablet" | "mobile" | "small-mobile" | "custom";
  label: string;
  width: number;
  height: number;
}
