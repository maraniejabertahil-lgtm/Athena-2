import React, { useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  FolderOpen,
  History,
  Pencil,
  Redo2,
  Settings,
  Share2,
  Undo2,
  User,
} from "lucide-react";
import { STUDIO_MODELS } from "../data/defaultProject.ts";
import { StudioModelId, StudioProject } from "../types/studio.ts";

interface TopToolbarProps {
  project: StudioProject;
  saveLabel: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRenameProject: (newName: string) => void;
  onModelChange: (modelId: StudioModelId) => void;
  onOpenProjects: () => void;
  onOpenVersions: () => void;
  onOpenShare: () => void;
  onExportZip: () => void;
  onOpenSettings: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  project,
  saveLabel,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onRenameProject,
  onModelChange,
  onOpenProjects,
  onOpenVersions,
  onOpenShare,
  onExportZip,
  onOpenSettings,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(project.name);
  const [profileOpen, setProfileOpen] = useState(false);

  const commitName = () => {
    if (draftName.trim()) {
      onRenameProject(draftName.trim());
    } else {
      setDraftName(project.name);
    }
    setEditingName(false);
  };

  return (
    <header className="h-13 shrink-0 border-b border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23] px-3 sm:px-4 flex items-center justify-between gap-3 select-none">
      {/* Left: Logo + Project Name + Model Selector + Save Status */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <rect width="24" height="24" rx="6" fill="#4285F4" />
            <path
              d="M7 6.5h2.7v4.3h4.6V6.5H17v11h-2.7v-4.4H9.7v4.4H7v-11z"
              fill="#FFFFFF"
            />
          </svg>
          <span className="font-display text-sm font-semibold tracking-tight text-slate-900 dark:text-[#F5F5F5] whitespace-nowrap hidden sm:inline">
            AI Studio
          </span>
        </div>

        <span className="text-slate-300 dark:text-[#292E38] hidden sm:inline">/</span>

        {/* Project Switcher & Rename */}
        <div className="flex items-center gap-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitName();
                  if (e.key === "Escape") {
                    setDraftName(project.name);
                    setEditingName(false);
                  }
                }}
                onBlur={commitName}
                autoFocus
                className="w-36 rounded-md border border-[#4285F4] bg-slate-50 dark:bg-[#111318] px-2 py-0.5 text-xs font-medium text-slate-900 dark:text-[#F5F5F5] focus:outline-none"
              />
              <button
                type="button"
                onClick={commitName}
                className="p-1 text-[#22C55E] cursor-pointer"
                aria-label="Confirm project name"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                onClick={onOpenProjects}
                title="Switch or manage projects"
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-[#222630] text-xs font-medium text-slate-900 dark:text-[#F5F5F5] truncate max-w-[140px] sm:max-w-[180px] cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-slate-500 dark:text-[#9CA3AF] shrink-0" />
                <span className="truncate">{project.name}</span>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftName(project.name);
                  setEditingName(true);
                }}
                title="Rename project"
                className="p-1 rounded text-slate-400 hover:text-slate-800 dark:hover:text-[#F5F5F5] cursor-pointer hidden md:inline-flex"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Model Selector */}
        <select
          aria-label="AI Model"
          value={project.model}
          onChange={(e) => onModelChange(e.target.value as StudioModelId)}
          className="hidden md:block rounded-md border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#222630] px-2.5 py-1 text-xs font-medium text-slate-800 dark:text-[#F5F5F5] focus:outline-none focus:ring-2 focus:ring-[#4285F4]/40 cursor-pointer"
        >
          {STUDIO_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        {/* Save Status */}
        <span className="hidden xl:inline text-[11px] text-slate-500 dark:text-[#9CA3AF] tabular-nums whitespace-nowrap">
          {saveLabel}
        </span>
      </div>

      {/* Right: Undo/Redo, Versions, Share, Export ZIP, Settings, Profile */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex items-center border border-slate-200 dark:border-[#292E38] rounded-lg overflow-hidden bg-slate-50 dark:bg-[#222630]">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo project change"
            className="p-1.5 text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-200 dark:bg-[#292E38]" />
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo project change"
            className="p-1.5 text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenVersions}
          title="Version history"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#222630] hover:bg-slate-50 dark:hover:bg-[#292E38] text-xs font-medium text-slate-700 dark:text-[#F5F5F5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <History className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">History</span>
        </button>

        <button
          type="button"
          onClick={onOpenShare}
          title="Share project"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#222630] hover:bg-slate-50 dark:hover:bg-[#292E38] text-xs font-medium text-slate-700 dark:text-[#F5F5F5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Share</span>
        </button>

        <button
          type="button"
          onClick={onExportZip}
          title="Export project as ZIP"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#4285F4] hover:bg-[#3574E2] text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export ZIP</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          title="Studio settings"
          aria-label="Studio settings"
          className="p-1.5 rounded-lg border border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#222630] hover:bg-slate-50 dark:hover:bg-[#292E38] text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((p) => !p)}
            aria-label="User profile"
            className="w-7 h-7 rounded-lg bg-[#222630] border border-[#292E38] text-[#F5F5F5] flex items-center justify-center hover:border-[#4285F4] transition-colors cursor-pointer"
          >
            <User className="w-3.5 h-3.5" />
          </button>

          {profileOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setProfileOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-60 z-40 rounded-xl border border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23] p-3 shadow-lg space-y-2">
                <div className="space-y-0.5 pb-2 border-b border-slate-200 dark:border-[#292E38]">
                  <div className="text-xs font-semibold text-slate-900 dark:text-[#F5F5F5]">
                    Personal Studio
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF] truncate">
                    maranie.jaber.tahil@gmail.com
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onOpenProjects();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-slate-700 dark:text-[#F5F5F5] hover:bg-slate-100 dark:hover:bg-[#222630] cursor-pointer"
                >
                  Manage Projects
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    onOpenVersions();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-slate-700 dark:text-[#F5F5F5] hover:bg-slate-100 dark:hover:bg-[#222630] cursor-pointer"
                >
                  Version Snapshots ({project.versions.length})
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
