import React, { useState } from "react";
import { Check, Copy, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { STUDIO_MODELS } from "../data/defaultProject.ts";
import {
  ProjectVersion,
  StudioModelId,
  StudioProject,
  ThinkingDepth,
} from "../types/studio.ts";

function ModalFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-[#292E38] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-[#F5F5F5]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-md text-slate-500 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export const ProjectsModal: React.FC<{
  projects: StudioProject[];
  activeProjectId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}> = ({
  projects,
  activeProjectId,
  onSelect,
  onCreate,
  onDelete,
  onClose,
}) => {
  const [newName, setNewName] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName("");
    onClose();
  };

  return (
    <ModalFrame title="Projects" onClose={onClose}>
      <div className="space-y-4">
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New project name (e.g. portfolio-site)"
            className="flex-1 rounded-lg border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-3 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] focus:outline-none focus:ring-2 focus:ring-[#4285F4]/40"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#4285F4] hover:bg-[#3574E2] text-white text-xs font-medium cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create</span>
          </button>
        </form>

        <div className="space-y-1.5">
          {projects.map((p) => {
            const active = p.id === activeProjectId;
            return (
              <div
                key={p.id}
                onClick={() => {
                  onSelect(p.id);
                  onClose();
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onSelect(p.id);
                    onClose();
                  }
                }}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border cursor-pointer ${
                  active
                    ? "border-[#4285F4] bg-[#4285F4]/10"
                    : "border-slate-200 dark:border-[#292E38] hover:bg-slate-50 dark:hover:bg-[#222630]"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-[#F5F5F5] truncate">
                    {p.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF] tabular-nums">
                    {Object.keys(p.files).length} files ·{" "}
                    {new Date(p.updatedAt).toLocaleString()}
                  </div>
                </div>

                {projects.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(p.id);
                    }}
                    aria-label="Delete project"
                    className="p-1.5 rounded text-slate-400 hover:text-[#EF4444] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ModalFrame>
  );
};

export const VersionsModal: React.FC<{
  versions: ProjectVersion[];
  onSaveSnapshot: (label: string) => void;
  onRestore: (version: ProjectVersion) => void;
  onClose: () => void;
}> = ({ versions, onSaveSnapshot, onRestore, onClose }) => {
  const [label, setLabel] = useState("");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSnapshot(label.trim() || `Manual Snapshot`);
    setLabel("");
  };

  return (
    <ModalFrame title="Version History" onClose={onClose}>
      <div className="space-y-4">
        <form onSubmit={handleSave} className="flex gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Snapshot label (optional)"
            className="flex-1 rounded-lg border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-3 py-2 text-xs text-slate-900 dark:text-[#F5F5F5]"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-[#4285F4] hover:bg-[#3574E2] text-white text-xs font-medium cursor-pointer shrink-0"
          >
            Save Snapshot
          </button>
        </form>

        <div className="space-y-2">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318]"
            >
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-900 dark:text-[#F5F5F5] truncate">
                  {v.label}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF] tabular-nums">
                  {new Date(v.createdAt).toLocaleString()} · {v.changedFilesCount} files
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onRestore(v);
                  onClose();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-[#292E38] bg-white dark:bg-[#222630] text-xs font-medium text-slate-800 dark:text-[#F5F5F5] hover:border-[#4285F4] cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restore</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </ModalFrame>
  );
};

export const ShareModal: React.FC<{
  project: StudioProject;
  bundledHtml: string;
  onClose: () => void;
}> = ({ project, bundledHtml, onClose }) => {
  const [copiedJson, setCopiedJson] = useState(false);

  const previewUrl = `${window.location.origin}/api/preview/page/${encodeURIComponent(
    project.id
  )}`;

  const handleCopyProjectBundle = async () => {
    await navigator.clipboard.writeText(
      JSON.stringify({ name: project.name, files: project.files }, null, 2)
    );
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1800);
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([bundledHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModalFrame title="Share & Publish" onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-700 dark:text-[#F5F5F5]">
            Live Preview Route
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={previewUrl}
              className="flex-1 rounded-lg border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-3 py-2 text-xs font-mono text-slate-700 dark:text-[#9CA3AF]"
            />
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg bg-[#4285F4] text-white text-xs font-medium shrink-0"
            >
              Open
            </a>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-[#292E38]">
          <button
            type="button"
            onClick={handleCopyProjectBundle}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-[#292E38] text-xs font-medium text-slate-800 dark:text-[#F5F5F5] hover:bg-slate-50 dark:hover:bg-[#222630] cursor-pointer"
          >
            {copiedJson ? (
              <Check className="w-3.5 h-3.5 text-[#22C55E]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedJson ? "Copied Project JSON" : "Copy Project JSON"}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadHtml}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-[#292E38] text-xs font-medium text-slate-800 dark:text-[#F5F5F5] hover:bg-slate-50 dark:hover:bg-[#222630] cursor-pointer"
          >
            <span>Download Standalone HTML</span>
          </button>
        </div>
      </div>
    </ModalFrame>
  );
};

export const SettingsModal: React.FC<{
  project: StudioProject;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onUpdateProject: (patch: Partial<StudioProject>) => void;
  onClose: () => void;
}> = ({ project, theme, onToggleTheme, onUpdateProject, onClose }) => {
  const modelDef =
    STUDIO_MODELS.find((m) => m.id === project.model) ?? STUDIO_MODELS[0];

  return (
    <ModalFrame title="Studio Settings" onClose={onClose}>
      <div className="space-y-5 text-xs">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-slate-900 dark:text-[#F5F5F5]">
              Appearance Theme
            </div>
            <div className="text-slate-500 dark:text-[#9CA3AF]">
              Switch between dark and light workspace themes.
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#222630] font-medium text-slate-900 dark:text-[#F5F5F5] cursor-pointer"
          >
            {theme === "dark" ? "Dark Mode" : "Light Mode"}
          </button>
        </div>

        <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-[#292E38]">
          <label className="block font-medium text-slate-900 dark:text-[#F5F5F5]">
            AI Model
          </label>
          <select
            value={project.model}
            onChange={(e) => {
              const id = e.target.value as StudioModelId;
              const def =
                STUDIO_MODELS.find((m) => m.id === id) ?? STUDIO_MODELS[0];
              onUpdateProject({
                model: id,
                thinkingLevel: def.supportedThinkingLevels.includes(
                  project.thinkingLevel
                )
                  ? project.thinkingLevel
                  : def.defaultThinkingLevel,
              });
            }}
            className="w-full rounded-lg border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-3 py-2 text-slate-900 dark:text-[#F5F5F5]"
          >
            {STUDIO_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.tagline}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block font-medium text-slate-900 dark:text-[#F5F5F5]">
            Thinking Depth
          </label>
          <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#111318] border border-slate-200 dark:border-[#292E38]">
            {modelDef.supportedThinkingLevels.map((lvl: ThinkingDepth) => (
              <button
                key={lvl}
                type="button"
                onClick={() => onUpdateProject({ thinkingLevel: lvl })}
                className={`py-1.5 rounded-md font-mono cursor-pointer ${
                  project.thinkingLevel === lvl
                    ? "bg-white dark:bg-[#222630] text-slate-900 dark:text-[#F5F5F5] font-semibold"
                    : "text-slate-500 dark:text-[#9CA3AF]"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-[#292E38] cursor-pointer">
          <div>
            <div className="font-medium text-slate-900 dark:text-[#F5F5F5]">
              Auto-Apply AI File Edits
            </div>
            <div className="text-slate-500 dark:text-[#9CA3AF]">
              Apply generated code immediately (you can still view diffs and undo).
            </div>
          </div>
          <input
            type="checkbox"
            checked={project.autoApplyChanges}
            onChange={(e) =>
              onUpdateProject({ autoApplyChanges: e.target.checked })
            }
            className="h-4 w-4 rounded text-[#4285F4]"
          />
        </label>

        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div>
            <div className="font-medium text-slate-900 dark:text-[#F5F5F5]">
              Google Search Grounding
            </div>
            <div className="text-slate-500 dark:text-[#9CA3AF]">
              Allow the assistant to search the web during coding conversations.
            </div>
          </div>
          <input
            type="checkbox"
            checked={project.useSearch}
            onChange={(e) => onUpdateProject({ useSearch: e.target.checked })}
            className="h-4 w-4 rounded text-[#4285F4]"
          />
        </label>

        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div>
            <div className="font-medium text-slate-900 dark:text-[#F5F5F5]">
              Auto-Fallback on Quota / Rate Limit
            </div>
            <div className="text-slate-500 dark:text-[#9CA3AF]">
              Automatically retries 429/503 errors per turn and switches across Gemini 4 Hydrogen, 3.1 Flash Lite, and 3.5 Flash Lite without losing tool progress. For higher limits, attach a billing-enabled key in Settings &gt; Secrets.
            </div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(project.fallbackOnQuota ?? true)}
            onChange={(e) =>
              onUpdateProject({ fallbackOnQuota: e.target.checked })
            }
            className="h-4 w-4 rounded text-[#4285F4]"
          />
        </label>

        <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-[#292E38]">
          <label className="block font-medium text-slate-900 dark:text-[#F5F5F5]">
            Custom Studio Instructions
          </label>
          <textarea
            rows={4}
            value={project.systemInstruction}
            onChange={(e) =>
              onUpdateProject({ systemInstruction: e.target.value })
            }
            placeholder="Optional design preferences, coding conventions, or persona rules..."
            className="w-full rounded-lg border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] p-2.5 text-slate-900 dark:text-[#F5F5F5] focus:outline-none focus:ring-2 focus:ring-[#4285F4]/40"
          />
        </div>
      </div>
    </ModalFrame>
  );
};
