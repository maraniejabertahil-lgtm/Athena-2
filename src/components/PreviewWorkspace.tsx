import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  Laptop,
  Maximize2,
  Minimize2,
  Monitor,
  RefreshCw,
  RotateCw,
  Smartphone,
  Tablet,
} from "lucide-react";
import { DEVICE_PRESETS, ZOOM_OPTIONS } from "../data/defaultProject.ts";
import { DevicePreset } from "../types/studio.ts";

interface PreviewWorkspaceProps {
  projectId: string;
  bundledHtml: string;
  isBundling: boolean;
  onRefresh: () => void;
  previewKey: number;
}

export const PreviewWorkspace: React.FC<PreviewWorkspaceProps> = ({
  projectId,
  bundledHtml,
  isBundling,
  onRefresh,
  previewKey,
}) => {
  const [presetId, setPresetId] = useState<DevicePreset["id"]>("desktop");
  const [customWidth, setCustomWidth] = useState(1024);
  const [customHeight, setCustomHeight] = useState(720);
  const [landscape, setLandscape] = useState(false);
  const [zoomMode, setZoomMode] = useState<number | "fit">("fit");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 900, height: 600 });

  const stageRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setContainerSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const basePreset =
    DEVICE_PRESETS.find((p) => p.id === presetId) ?? DEVICE_PRESETS[0];

  const rawWidth = presetId === "custom" ? customWidth : basePreset.width;
  const rawHeight = presetId === "custom" ? customHeight : basePreset.height;

  const viewportWidth = landscape ? rawHeight : rawWidth;
  const viewportHeight = landscape ? rawWidth : rawHeight;

  const scale = useMemo(() => {
    if (zoomMode !== "fit") {
      return zoomMode / 100;
    }
    const availW = Math.max(200, containerSize.width - 36);
    const availH = Math.max(200, containerSize.height - 36);
    const ratio = Math.min(availW / viewportWidth, availH / viewportHeight, 1);
    return Math.max(0.2, Number(ratio.toFixed(3)));
  }, [zoomMode, containerSize, viewportWidth, viewportHeight]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && rootRef.current) {
        await rootRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  const getPresetIcon = (id: DevicePreset["id"]) => {
    switch (id) {
      case "desktop":
        return <Monitor className="w-3.5 h-3.5" />;
      case "laptop":
        return <Laptop className="w-3.5 h-3.5" />;
      case "tablet":
        return <Tablet className="w-3.5 h-3.5" />;
      case "mobile":
      case "small-mobile":
        return <Smartphone className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  return (
    <div
      ref={rootRef}
      className={`h-full flex flex-col bg-slate-100 dark:bg-[#111318] overflow-hidden ${
        isFullscreen ? "fixed inset-0 z-50" : ""
      }`}
    >
      {/* Responsive Device Toolbar */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#191C23] flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Device Presets */}
        <div className="flex flex-wrap items-center gap-1">
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 dark:bg-[#111318] border border-slate-200 dark:border-[#292E38]">
            {DEVICE_PRESETS.map((preset) => {
              const active = presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setPresetId(preset.id);
                    setLandscape(false);
                  }}
                  title={`${preset.label} (${preset.width} × ${preset.height})`}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? "bg-white dark:bg-[#222630] text-slate-900 dark:text-[#F5F5F5] shadow-xs"
                      : "text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5]"
                  }`}
                >
                  {getPresetIcon(preset.id)}
                  <span className="hidden xl:inline">{preset.label}</span>
                </button>
              );
            })}
          </div>

          {presetId === "custom" && (
            <div className="flex items-center gap-1 ml-1 text-xs">
              <input
                type="number"
                min={240}
                max={3840}
                value={customWidth}
                onChange={(e) =>
                  setCustomWidth(Math.max(240, Number(e.target.value) || 320))
                }
                aria-label="Custom width"
                className="w-16 rounded-md border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-2 py-1 text-xs font-mono tabular-nums text-slate-900 dark:text-[#F5F5F5]"
              />
              <span className="text-slate-400">×</span>
              <input
                type="number"
                min={240}
                max={2160}
                value={customHeight}
                onChange={(e) =>
                  setCustomHeight(Math.max(240, Number(e.target.value) || 480))
                }
                aria-label="Custom height"
                className="w-16 rounded-md border border-slate-200 dark:border-[#292E38] bg-slate-50 dark:bg-[#111318] px-2 py-1 text-xs font-mono tabular-nums text-slate-900 dark:text-[#F5F5F5]"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setLandscape((prev) => !prev)}
            title="Rotate portrait / landscape"
            className={`p-1.5 rounded-md border text-xs transition-colors cursor-pointer ${
              landscape
                ? "border-[#4285F4] text-[#4285F4] bg-[#4285F4]/10"
                : "border-slate-200 dark:border-[#292E38] text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5]"
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <span className="hidden sm:inline ml-1 text-[11px] font-mono text-slate-500 dark:text-[#9CA3AF] tabular-nums">
            {viewportWidth} × {viewportHeight} · {Math.round(scale * 100)}%
          </span>
        </div>

        {/* Zoom + Actions */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-100 dark:bg-[#111318] border border-slate-200 dark:border-[#292E38]">
            {ZOOM_OPTIONS.map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoomMode(z)}
                className={`px-2 py-1 rounded-md text-[11px] font-mono tabular-nums cursor-pointer ${
                  zoomMode === z
                    ? "bg-white dark:bg-[#222630] text-slate-900 dark:text-[#F5F5F5]"
                    : "text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5]"
                }`}
              >
                {z}%
              </button>
            ))}
            <button
              type="button"
              onClick={() => setZoomMode("fit")}
              className={`px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer ${
                zoomMode === "fit"
                  ? "bg-white dark:bg-[#222630] text-slate-900 dark:text-[#F5F5F5]"
                  : "text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5]"
              }`}
            >
              Fit
            </button>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            title="Refresh preview"
            className="p-1.5 rounded-md border border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#222630] text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isBundling ? "animate-spin text-[#4285F4]" : ""}`}
            />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen preview"}
            className="p-1.5 rounded-md border border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#222630] text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5] cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <a
            href={`/api/preview/page/${encodeURIComponent(projectId)}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open preview in a new browser tab"
            className="p-1.5 rounded-md border border-slate-200 dark:border-[#292E38] bg-white dark:bg-[#222630] text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F5F5F5]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Sandboxed Responsive Viewport Stage */}
      <div
        ref={stageRef}
        className="flex-1 overflow-auto flex items-center justify-center p-4"
      >
        <div
          style={{
            width: Math.round(viewportWidth * scale),
            height: Math.round(viewportHeight * scale),
          }}
          className="relative shrink-0 rounded-xl border border-slate-300 dark:border-[#292E38] bg-slate-950 shadow-xl overflow-hidden"
        >
          <iframe
            key={previewKey}
            title="Live Project Preview"
            sandbox="allow-scripts allow-forms allow-modals"
            srcDoc={bundledHtml}
            style={{
              width: `${viewportWidth}px`,
              height: `${viewportHeight}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            className="border-0 bg-white"
          />
        </div>
      </div>
    </div>
  );
};
