import React, { useMemo, useRef, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  File,
  FilePlus2,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Search,
  Sparkles,
  Terminal as TerminalIcon,
  Trash2,
  X,
} from "lucide-react";
import { ensureMonacoSetup, getMonacoLanguage } from "../lib/monacoSetup.ts";
import {
  BottomPanelTab,
  BuildLogEntry,
  BundleDiagnostic,
  ConsoleEntry,
} from "../types/studio.ts";

ensureMonacoSetup();

interface CodeWorkspaceProps {
  files: Record<string, string>;
  openTabs: string[];
  activeFile: string;
  theme: "dark" | "light";
  diagnostics: BundleDiagnostic[];
  consoleEntries: ConsoleEntry[];
  buildLogs: BuildLogEntry[];
  runtimeErrors: ConsoleEntry[];
  onSelectFile: (path: string) => void;
  onCloseTab: (path: string) => void;
  onUpdateFileContent: (path: string, content: string) => void;
  onCreateFile: (path: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
  onDeleteFile: (path: string) => void;
  onClearConsole: () => void;
  onRunBuild: () => void;
  onAskAiEdit: (prompt: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: TreeNode[];
}

function buildFileTree(filePaths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const fullPath of [...filePaths].sort((a, b) => a.localeCompare(b))) {
    const parts = fullPath.split("/");
    let currentLevel = root;

    parts.forEach((part, index) => {
      const isFolder = index < parts.length - 1;
      const nodePath = parts.slice(0, index + 1).join("/");
      let existing = currentLevel.find(
        (n) => n.name === part && n.isFolder === isFolder
      );
      if (!existing) {
        existing = { name: part, path: nodePath, isFolder, children: [] };
        currentLevel.push(existing);
      }
      currentLevel = existing.children;
    });
  }

  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes
      .sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((n) => ({ ...n, children: sortNodes(n.children) }));
  };

  return sortNodes(root);
}

export const CodeWorkspace: React.FC<CodeWorkspaceProps> = ({
  files,
  openTabs,
  activeFile,
  theme,
  diagnostics,
  consoleEntries,
  buildLogs,
  runtimeErrors,
  onSelectFile,
  onCloseTab,
  onUpdateFileContent,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  onClearConsole,
  onRunBuild,
  onAskAiEdit,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    src: true,
    "src/components": true,
    "src/pages": true,
    public: true,
  });
  const [creatingType, setCreatingType] = useState<"file" | "folder" | null>(null);
  const [newPathInput, setNewPathInput] = useState("");
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  const [bottomOpen, setBottomOpen] = useState(true);
  const [bottomTab, setBottomTab] = useState<BottomPanelTab>("problems");
  const [bottomHeight, setBottomHeight] = useState(175);

  const [terminalInput, setTerminalInput] = useState("");
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "Hydrogen Studio Terminal — type 'help' for available commands.",
  ]);

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const fileTree = useMemo(
    () => buildFileTree(Object.keys(files)),
    [files]
  );

  const activeContent = files[activeFile] ?? "";

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const handleTriggerFind = () => {
    editorRef.current?.getAction("editor.action.startFindReplaceAction")?.run();
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeContent);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    } catch {
      // Ignore
    }
  };

  const handleDownloadCurrentFile = () => {
    const blob = new Blob([activeContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeFile.split("/").pop() || "file.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newPathInput.trim().replace(/^\/+/, "");
    if (!cleaned) {
      setCreatingType(null);
      return;
    }
    if (creatingType === "folder") {
      const target = cleaned.endsWith("/")
        ? `${cleaned}index.js`
        : `${cleaned}/index.js`;
      onCreateFile(target);
      setExpandedFolders((prev) => ({ ...prev, [cleaned]: true }));
    } else {
      onCreateFile(cleaned);
    }
    setNewPathInput("");
    setCreatingType(null);
  };

  const handleTerminalCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = terminalInput.trim();
    if (!cmd) return;
    setTerminalInput("");

    const output: string[] = [`$ ${cmd}`];
    const [base, ...args] = cmd.split(/\s+/);

    if (base === "help") {
      output.push(
        "Commands: ls, tree, cat <file>, build, clear, ai <prompt>"
      );
    } else if (base === "clear") {
      setTerminalLines([]);
      return;
    } else if (base === "ls" || base === "tree" || base === "files") {
      output.push(...Object.keys(files).sort());
    } else if (base === "cat") {
      const target = args.join(" ");
      if (target && target in files) {
        output.push(files[target].slice(0, 1200));
      } else {
        output.push(`File not found: ${target}`);
      }
    } else if (base === "build") {
      onRunBuild();
      output.push("Triggered live project rebuild.");
    } else if (base === "ai") {
      const prompt = args.join(" ");
      if (prompt) {
        onAskAiEdit(prompt);
        output.push(`Sent prompt to AI Assistant: "${prompt}"`);
      } else {
        output.push("Usage: ai <instruction>");
      }
    } else {
      output.push(`Unknown command "${base}". Type 'help' for commands.`);
    }

    setTerminalLines((prev) => [...prev, ...output]);
  };

  const renderTreeNodes = (nodes: TreeNode[], depth = 0) => {
    return nodes.map((node) => {
      if (node.isFolder) {
        const isOpen = Boolean(expandedFolders[node.path]);
        return (
          <div key={node.path}>
            <button
              type="button"
              onClick={() =>
                setExpandedFolders((prev) => ({
                  ...prev,
                  [node.path]: !prev[node.path],
                }))
              }
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              className="w-full flex items-center gap-1.5 pr-2 py-1 text-left text-xs text-slate-700 dark:text-[#9CA3AF] hover:bg-slate-100 dark:hover:bg-[#222630] hover:text-slate-900 dark:hover:text-[#F5F5F5] cursor-pointer"
            >
              {isOpen ? (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              )}
              {isOpen ? (
                <FolderOpen className="w-3.5 h-3.5 text-[#4285F4] shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-[#4285F4] shrink-0" />
              )}
              <span className="truncate">{node.name}</span>
            </button>
            {isOpen && renderTreeNodes(node.children, depth + 1)}
          </div>
        );
      }

      const isActive = node.path === activeFile;
      const isRenaming = renamingPath === node.path;

      return (
        <div
          key={node.path}
          style={{ paddingLeft: `${depth * 12 + 22}px` }}
          className={`group flex items-center justify-between gap-1 pr-2 py-1 text-xs cursor-pointer ${
            isActive
              ? "bg-slate-200/80 dark:bg-[#222630] text-slate-900 dark:text-[#F5F5F5] font-medium"
              : "text-slate-600 dark:text-[#9CA3AF] hover:bg-slate-100 dark:hover:bg-[#222630]/60 hover:text-slate-900 dark:hover:text-[#F5F5F5]"
          }`}
          onClick={() => {
            if (!isRenaming) onSelectFile(node.path);
          }}
        >
          {isRenaming ? (
            <input
              type="text"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameDraft.trim()) {
                  onRenameFile(node.path, renameDraft.trim());
                  setRenamingPath(null);
                }
                if (e.key === "Escape") setRenamingPath(null);
              }}
              onBlur={() => setRenamingPath(null)}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded border border-[#4285F4] bg-white dark:bg-[#111318] px-1.5 py-0.5 text-xs text-slate-900 dark:text-[#F5F5F5] focus:outline-none"
            />
          ) : (
            <>
              <div className="flex items-center gap-1.5 min-w-0">
                <File className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{node.name}</span>
              </div>
              <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingPath(node.path);
                    setRenameDraft(node.path);
                  }}
                  title="Rename file"
                  className="p-0.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                {Object.keys(files).length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFile(node.path);
                    }}
                    title="Delete file"
                    className="p-0.5 text-slate-400 hover:text-[#EF4444] cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      );
    });
  };

  const problemCount = diagnostics.length;
  const errorCount = runtimeErrors.length;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#111318] overflow-hidden">
      {/* Main Editor Area: File Explorer + Monaco Editor */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* File Explorer Sidebar */}
        <div className="w-52 shrink-0 border-r border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#191C23] flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 dark:border-[#292E38] flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500 dark:text-[#9CA3AF]">
              EXPLORER
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setCreatingType("file");
                  setNewPathInput("src/components/");
                }}
                title="New file"
                className="p-1 rounded text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] cursor-pointer"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatingType("folder");
                  setNewPathInput("src/");
                }}
                title="New folder"
                className="p-1 rounded text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {creatingType && (
            <form
              onSubmit={handleCreateSubmit}
              className="p-2 border-b border-slate-200 dark:border-[#292E38] space-y-1.5"
            >
              <input
                type="text"
                value={newPathInput}
                onChange={(e) => setNewPathInput(e.target.value)}
                placeholder={
                  creatingType === "folder"
                    ? "src/utils"
                    : "src/components/Card.jsx"
                }
                autoFocus
                className="w-full rounded border border-[#4285F4] bg-white dark:bg-[#111318] px-2 py-1 text-xs font-mono text-slate-900 dark:text-[#F5F5F5] focus:outline-none"
              />
              <div className="flex justify-end gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setCreatingType(null)}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-2 py-0.5 rounded bg-[#4285F4] text-white cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          )}

          <div className="flex-1 overflow-y-auto py-1">
            {renderTreeNodes(fileTree)}
          </div>
        </div>

        {/* Editor Tabs + Monaco */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Tabs & Editor Toolbar */}
          <div className="h-9 shrink-0 border-b border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#191C23] flex items-center justify-between gap-2 px-1">
            <div className="flex items-center overflow-x-auto h-full">
              {openTabs.map((tabPath) => {
                const active = tabPath === activeFile;
                const fileName = tabPath.split("/").pop() || tabPath;
                return (
                  <div
                    key={tabPath}
                    onClick={() => onSelectFile(tabPath)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSelectFile(tabPath);
                    }}
                    className={`h-full flex items-center gap-2 px-3 border-r border-slate-200 dark:border-[#292E38] text-xs whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? "bg-white dark:bg-[#111318] text-slate-900 dark:text-[#F5F5F5] font-medium"
                        : "text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5]"
                    }`}
                  >
                    <span>{fileName}</span>
                    {openTabs.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseTab(tabPath);
                        }}
                        aria-label={`Close ${fileName}`}
                        className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-[#222630] cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-1 pr-1 shrink-0">
              <button
                type="button"
                onClick={handleTriggerFind}
                title="Search and replace (Ctrl/Cmd+F)"
                className="p-1.5 rounded text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCopyCode}
                title="Copy file code"
                className="p-1.5 rounded text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] cursor-pointer"
              >
                {copiedCode ? (
                  <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadCurrentFile}
                title="Download file"
                className="p-1.5 rounded text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  onAskAiEdit(`Improve and refactor ${activeFile}: `)
                }
                title="AI-assisted edit for current file"
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#4285F4]/15 text-[#4285F4] hover:bg-[#4285F4]/25 text-[11px] font-medium cursor-pointer whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3 h-3" />
                <span className="hidden sm:inline">AI Edit</span>
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 min-h-0">
            <Editor
              path={activeFile}
              value={activeContent}
              language={getMonacoLanguage(activeFile)}
              theme={theme === "dark" ? "vs-dark" : "light"}
              onMount={handleEditorMount}
              onChange={(val) => onUpdateFileContent(activeFile, val ?? "")}
              options={{
                fontSize: 13,
                fontFamily: "JetBrains Mono, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 12 },
              }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Developer Panel */}
      <div
        style={{ height: bottomOpen ? bottomHeight : 34 }}
        className="shrink-0 border-t border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23] flex flex-col overflow-hidden"
      >
        <div className="h-[34px] shrink-0 px-3 border-b border-slate-200 dark:border-[#292E38] flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 overflow-x-auto text-xs">
            {(
              [
                {
                  id: "problems",
                  label: `Problems (${problemCount})`,
                },
                {
                  id: "console",
                  label: `Console (${consoleEntries.length})`,
                },
                { id: "build", label: "Build Logs" },
                {
                  id: "errors",
                  label: `Runtime Errors (${errorCount})`,
                },
                { id: "terminal", label: "Terminal" },
              ] as Array<{ id: BottomPanelTab; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setBottomTab(tab.id);
                  setBottomOpen(true);
                }}
                className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                  bottomTab === tab.id && bottomOpen
                    ? "border-[#4285F4] text-slate-900 dark:text-[#F5F5F5] font-medium"
                    : "border-transparent text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {bottomOpen && (
              <>
                <select
                  aria-label="Panel height"
                  value={bottomHeight}
                  onChange={(e) => setBottomHeight(Number(e.target.value))}
                  className="hidden sm:block rounded border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-1.5 py-0.5 text-[11px] text-slate-600 dark:text-[#9CA3AF]"
                >
                  <option value={140}>Compact</option>
                  <option value={175}>Standard</option>
                  <option value={260}>Tall</option>
                </select>
                {bottomTab === "console" && (
                  <button
                    type="button"
                    onClick={onClearConsole}
                    className="text-[11px] text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => setBottomOpen((prev) => !prev)}
              className="text-[11px] text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              {bottomOpen ? "Minimize" : "Expand"}
            </button>
          </div>
        </div>

        {bottomOpen && (
          <div className="flex-1 overflow-y-auto p-2.5 font-mono text-xs bg-slate-50 dark:bg-[#111318]">
            {bottomTab === "problems" && (
              <div className="space-y-1.5">
                {diagnostics.length === 0 ? (
                  <div className="text-slate-500 dark:text-[#9CA3AF]">
                    No build problems detected.
                  </div>
                ) : (
                  diagnostics.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => {
                        if (d.file && d.file in files) onSelectFile(d.file);
                      }}
                      className="flex items-start gap-2 text-[#EF4444] cursor-pointer hover:underline"
                    >
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>
                        {d.file ? `${d.file}${d.line ? `:${d.line}` : ""} — ` : ""}
                        {d.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {bottomTab === "console" && (
              <div className="space-y-1">
                {consoleEntries.length === 0 ? (
                  <div className="text-slate-500 dark:text-[#9CA3AF]">
                    Console output from the live preview will appear here.
                  </div>
                ) : (
                  consoleEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={
                        entry.level === "error"
                          ? "text-[#EF4444]"
                          : entry.level === "warn"
                          ? "text-amber-400"
                          : "text-slate-700 dark:text-[#F5F5F5]"
                      }
                    >
                      <span className="text-slate-400 dark:text-[#9CA3AF] mr-2 tabular-nums">
                        [{new Date(entry.timestamp).toLocaleTimeString()}]
                      </span>
                      {entry.message}
                    </div>
                  ))
                )}
              </div>
            )}

            {bottomTab === "build" && (
              <div className="space-y-1">
                {buildLogs.length === 0 ? (
                  <div className="text-slate-500 dark:text-[#9CA3AF]">
                    No builds executed yet.
                  </div>
                ) : (
                  buildLogs.map((log) => (
                    <div
                      key={log.id}
                      className={
                        log.status === "error"
                          ? "text-[#EF4444]"
                          : log.status === "success"
                          ? "text-[#22C55E]"
                          : "text-slate-500 dark:text-[#9CA3AF]"
                      }
                    >
                      <span className="opacity-70 mr-2 tabular-nums">
                        [{new Date(log.timestamp).toLocaleTimeString()}]
                      </span>
                      {log.message}
                    </div>
                  ))
                )}
              </div>
            )}

            {bottomTab === "errors" && (
              <div className="space-y-2">
                {runtimeErrors.length === 0 ? (
                  <div className="text-slate-500 dark:text-[#9CA3AF]">
                    No runtime errors recorded.
                  </div>
                ) : (
                  runtimeErrors.map((err) => (
                    <div
                      key={err.id}
                      className="flex items-center justify-between gap-2 text-[#EF4444]"
                    >
                      <span>{err.message}</span>
                      <button
                        type="button"
                        onClick={() =>
                          onAskAiEdit(`Fix this runtime error: ${err.message}`)
                        }
                        className="px-2 py-0.5 rounded bg-[#4285F4] text-white text-[11px] font-sans cursor-pointer shrink-0"
                      >
                        Fix with AI
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {bottomTab === "terminal" && (
              <div className="flex flex-col h-full justify-between space-y-2">
                <div className="space-y-1 text-slate-700 dark:text-[#F5F5F5]">
                  {terminalLines.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap">
                      {line}
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={handleTerminalCommand}
                  className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-[#292E38]"
                >
                  <TerminalIcon className="w-3.5 h-3.5 text-[#4285F4] shrink-0" />
                  <input
                    type="text"
                    value={terminalInput}
                    onChange={(e) => setTerminalInput(e.target.value)}
                    placeholder="Type a command (ls, tree, cat src/App.jsx, build, ai <prompt>)..."
                    className="flex-1 bg-transparent text-xs text-slate-900 dark:text-[#F5F5F5] focus:outline-none"
                  />
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
