import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/editor/editor.worker.js?worker";
import cssWorker from "monaco-editor/language/css/css.worker.js?worker";
import htmlWorker from "monaco-editor/language/html/html.worker.js?worker";
import jsonWorker from "monaco-editor/language/json/json.worker.js?worker";
import tsWorker from "monaco-editor/language/typescript/ts.worker.js?worker";

let initialized = false;

export function ensureMonacoSetup() {
  if (initialized) return;
  initialized = true;

  (self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
    getWorker(_: unknown, label: string) {
      if (label === "json") return new jsonWorker();
      if (label === "css" || label === "scss" || label === "less") {
        return new cssWorker();
      }
      if (label === "html" || label === "handlebars" || label === "razor") {
        return new htmlWorker();
      }
      if (label === "typescript" || label === "javascript") {
        return new tsWorker();
      }
      return new editorWorker();
    },
  };

  // Configure JSX/TSX compiler options so React JSX renders cleanly without false errors
  const tsDefaults = (
    monaco.languages as unknown as {
      typescript?: {
        javascriptDefaults?: {
          setCompilerOptions: (opts: Record<string, unknown>) => void;
          setDiagnosticsOptions: (opts: Record<string, unknown>) => void;
        };
        typescriptDefaults?: {
          setCompilerOptions: (opts: Record<string, unknown>) => void;
          setDiagnosticsOptions: (opts: Record<string, unknown>) => void;
        };
        JsxEmit?: Record<string, number>;
        ScriptTarget?: Record<string, number>;
        ModuleResolutionKind?: Record<string, number>;
        ModuleKind?: Record<string, number>;
      };
    }
  ).typescript;

  if (tsDefaults) {
    const compilerOpts = {
      target: tsDefaults.ScriptTarget?.ES2022 ?? 99,
      allowNonTsExtensions: true,
      moduleResolution: tsDefaults.ModuleResolutionKind?.NodeJs ?? 2,
      module: tsDefaults.ModuleKind?.ESNext ?? 99,
      noEmit: true,
      esModuleInterop: true,
      jsx: tsDefaults.JsxEmit?.ReactJSX ?? 4,
      allowJs: true,
      checkJs: false,
    };
    tsDefaults.javascriptDefaults?.setCompilerOptions(compilerOpts);
    tsDefaults.typescriptDefaults?.setCompilerOptions(compilerOpts);
    tsDefaults.javascriptDefaults?.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
    tsDefaults.typescriptDefaults?.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
  }

  loader.config({ monaco });
}

export function getMonacoLanguage(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".tsx") || lower.endsWith(".ts")) return "typescript";
  if (lower.endsWith(".jsx") || lower.endsWith(".js")) return "javascript";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".html") || lower.endsWith(".svg")) return "html";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md")) return "markdown";
  return "plaintext";
}
