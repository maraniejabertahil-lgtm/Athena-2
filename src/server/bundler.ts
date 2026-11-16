import * as esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { compile as compileTailwind } from "tailwindcss";

export interface BundleDiagnostic {
  id: string;
  severity: "error" | "warning";
  file?: string;
  line?: number;
  column?: number;
  message: string;
}

export interface BundleResult {
  ok: boolean;
  html: string;
  diagnostics: BundleDiagnostic[];
  durationMs: number;
  bundleSizeBytes: number;
}

let cachedTailwindCss: string | null = null;

function getTailwindBaseCss(): string {
  if (cachedTailwindCss !== null) return cachedTailwindCss;
  const twPath = path.resolve(process.cwd(), "node_modules/tailwindcss/index.css");
  cachedTailwindCss = fs.readFileSync(twPath, "utf8");
  return cachedTailwindCss;
}

function normalizeVirtualPath(p: string): string {
  return p.replace(/^\/+/, "").replace(/^\.\//, "");
}

function resolveVirtualFile(
  files: Record<string, string>,
  rawPath: string
): string | null {
  const clean = normalizeVirtualPath(rawPath);
  if (clean in files) return clean;

  const extensions = [".tsx", ".ts", ".jsx", ".js", ".css", ".json", ".svg"];
  for (const ext of extensions) {
    if (`${clean}${ext}` in files) return `${clean}${ext}`;
  }
  for (const ext of extensions) {
    if (`${clean}/index${ext}` in files) return `${clean}/index${ext}`;
  }
  return null;
}

function extractCandidates(files: Record<string, string>): string[] {
  const set = new Set<string>();
  const tokenRegex = /[A-Za-z0-9_:/\[\].!%#-]+/g;
  for (const [filePath, content] of Object.entries(files)) {
    if (/\.(html|jsx|tsx|js|ts|css|svg)$/i.test(filePath)) {
      const matches = content.match(tokenRegex);
      if (matches) {
        for (const m of matches) {
          if (m.length > 1 && m.length < 80) {
            set.add(m);
          }
        }
      }
    }
  }
  return Array.from(set);
}

async function compileProjectCss(files: Record<string, string>): Promise<string> {
  const cssEntries = Object.entries(files).filter(([k]) => k.endsWith(".css"));
  const userCss = cssEntries.map(([, v]) => v).join("\n\n");
  const hasTailwindImport =
    userCss.includes("@import \"tailwindcss\"") ||
    userCss.includes("@import 'tailwindcss'") ||
    Object.keys(files).some((k) => /\.(jsx|tsx|html)$/i.test(k));

  if (!hasTailwindImport) {
    return userCss;
  }

  const inputCss = userCss.includes("tailwindcss")
    ? userCss
    : `@import "tailwindcss";\n${userCss}`;

  try {
    const twBase = getTailwindBaseCss();
    const twDir = path.resolve(process.cwd(), "node_modules/tailwindcss");
    const compiler = await compileTailwind(inputCss, {
      loadStylesheet: async (id: string) => {
        if (id === "tailwindcss") {
          return {
            path: path.join(twDir, "index.css"),
            base: twDir,
            content: twBase,
          };
        }
        throw new Error(`Stylesheet not found: ${id}`);
      },
    });
    const candidates = extractCandidates(files);
    return compiler.build(candidates);
  } catch {
    return userCss;
  }
}

const CONSOLE_BRIDGE_SCRIPT = `<script>
(function () {
  function send(level, args) {
    try {
      var text = Array.prototype.slice.call(args).map(function (a) {
        if (typeof a === "string") return a;
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      }).join(" ");
      window.parent.postMessage({ source: "hydrogen-preview", type: "console", level: level, message: text }, "*");
    } catch (e) {}
  }
  ["log", "info", "warn", "error"].forEach(function (lvl) {
    var orig = console[lvl];
    console[lvl] = function () {
      send(lvl, arguments);
      if (orig) orig.apply(console, arguments);
    };
  });
  window.addEventListener("error", function (event) {
    try {
      window.parent.postMessage({
        source: "hydrogen-preview",
        type: "runtime-error",
        message: event.message + (event.lineno ? " (line " + event.lineno + ")" : "")
      }, "*");
    } catch (e) {}
  });
  window.addEventListener("unhandledrejection", function (event) {
    try {
      var reason = event.reason && event.reason.message ? event.reason.message : String(event.reason);
      window.parent.postMessage({
        source: "hydrogen-preview",
        type: "runtime-error",
        message: "Unhandled Promise Rejection: " + reason
      }, "*");
    } catch (e) {}
  });
})();
</script>`;

export async function bundleProjectFiles(
  rawFiles: Record<string, string>
): Promise<BundleResult> {
  const startedAt = Date.now();
  const files: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawFiles)) {
    files[normalizeVirtualPath(k)] = v;
  }

  const diagnostics: BundleDiagnostic[] = [];
  const entryCandidates = [
    "src/main.tsx",
    "src/main.jsx",
    "src/main.ts",
    "src/main.js",
    "src/index.tsx",
    "src/index.jsx",
    "src/App.tsx",
    "src/App.jsx",
  ];

  const entryFile = entryCandidates.find((c) => c in files);
  const compiledCss = await compileProjectCss(files);
  const rawHtml =
    files["index.html"] ||
    `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body><div id="root"></div></body></html>`;

  if (!entryFile) {
    // Pure static HTML/CSS/JS fallback
    let html = rawHtml;
    if (compiledCss.trim()) {
      html = html.replace("</head>", `<style>${compiledCss}</style></head>`);
    }
    html = html.replace("</head>", `${CONSOLE_BRIDGE_SCRIPT}</head>`);
    return {
      ok: true,
      html,
      diagnostics,
      durationMs: Date.now() - startedAt,
      bundleSizeBytes: Buffer.byteLength(html, "utf8"),
    };
  }

  let jsBundle = "";
  const nodeModulesDir = path.resolve(process.cwd(), "node_modules");

  try {
    const virtualPlugin: esbuild.Plugin = {
      name: "hydrogen-virtual-fs",
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) => {
          if (args.kind === "entry-point") {
            return { path: normalizeVirtualPath(args.path), namespace: "vfs" };
          }

          const isNodeModuleImporter =
            args.importer.includes("node_modules") ||
            path.isAbsolute(args.importer);
          const importerVfsPath = normalizeVirtualPath(args.importer);
          const isVfsImporter = !isNodeModuleImporter && importerVfsPath in files;

          if (
            isVfsImporter &&
            (args.path.startsWith(".") ||
              args.path.startsWith("@/") ||
              args.path.startsWith("/"))
          ) {
            let target = args.path;
            if (target.startsWith("@/")) {
              target = `src/${target.slice(2)}`;
            } else if (target.startsWith("/")) {
              target = target.slice(1);
            } else {
              const baseDir = path.posix.dirname(importerVfsPath);
              target = path.posix.normalize(
                path.posix.join(baseDir === "." ? "" : baseDir, target)
              );
            }

            const matched = resolveVirtualFile(files, target);
            if (matched) {
              return { path: matched, namespace: "vfs" };
            }
          }

          // Bare imports ("react", "react-dom/client", "lucide-react") and node_modules internals
          return undefined;
        });

        build.onLoad({ filter: /.*/, namespace: "vfs" }, (args) => {
          const vpath = normalizeVirtualPath(args.path);
          const content = files[vpath];
          if (content === undefined) {
            return { errors: [{ text: `File not found: ${vpath}` }] };
          }

          if (vpath.endsWith(".css")) {
            return { contents: "", loader: "js", resolveDir: process.cwd() };
          }
          if (vpath.endsWith(".json")) {
            return { contents: content, loader: "json", resolveDir: process.cwd() };
          }
          if (vpath.endsWith(".tsx")) {
            return { contents: content, loader: "tsx", resolveDir: process.cwd() };
          }
          if (vpath.endsWith(".ts")) {
            return { contents: content, loader: "ts", resolveDir: process.cwd() };
          }
          if (vpath.endsWith(".jsx")) {
            return { contents: content, loader: "jsx", resolveDir: process.cwd() };
          }
          return { contents: content, loader: "js", resolveDir: process.cwd() };
        });
      },
    };

    const result = await esbuild.build({
      entryPoints: [entryFile],
      bundle: true,
      write: false,
      format: "iife",
      platform: "browser",
      target: ["es2020"],
      jsx: "automatic",
      nodePaths: [nodeModulesDir],
      plugins: [virtualPlugin],
      define: {
        "process.env.NODE_ENV": '"development"',
      },
      logLevel: "silent",
    });

    for (const warn of result.warnings) {
      diagnostics.push({
        id: crypto.randomUUID(),
        severity: "warning",
        file: warn.location?.file,
        line: warn.location?.line,
        column: warn.location?.column,
        message: warn.text,
      });
    }

    jsBundle = result.outputFiles[0]?.text ?? "";
  } catch (err) {
    const buildErr = err as esbuild.BuildFailure;
    if (Array.isArray(buildErr.errors)) {
      for (const e of buildErr.errors) {
        diagnostics.push({
          id: crypto.randomUUID(),
          severity: "error",
          file: e.location?.file,
          line: e.location?.line,
          column: e.location?.column,
          message: e.text,
        });
      }
    } else {
      diagnostics.push({
        id: crypto.randomUUID(),
        severity: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }

    const errorHtml = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    ${CONSOLE_BRIDGE_SCRIPT}
    <style>
      body { margin: 0; font-family: ui-monospace, monospace; background: #111318; color: #f5f5f5; padding: 24px; }
      .box { border: 1px solid #ef4444; background: #191c23; border-radius: 10px; padding: 16px; max-width: 720px; }
      h2 { margin: 0 0 8px 0; font-size: 14px; color: #ef4444; }
      pre { margin: 0; white-space: pre-wrap; font-size: 12px; line-height: 1.5; color: #fca5a5; }
    </style>
  </head>
  <body>
    <div class="box">
      <h2>Build Error</h2>
      <pre>${diagnostics.map((d) => `${d.file ? d.file + (d.line ? `:${d.line}` : "") + " - " : ""}${d.message}`).join("\n\n")}</pre>
    </div>
  </body>
</html>`;

    return {
      ok: false,
      html: errorHtml,
      diagnostics,
      durationMs: Date.now() - startedAt,
      bundleSizeBytes: Buffer.byteLength(errorHtml, "utf8"),
    };
  }

  // Strip module entry script tags pointing to /src/main.* so our bundled IIFE runs cleanly
  let html = rawHtml.replace(
    /<script[^>]*type=["']module["'][^>]*src=["'][^"']*main\.(jsx|tsx|js|ts)["'][^>]*>\s*<\/script>/gi,
    ""
  );

  const safeJs = jsBundle.replace(/<\/script/gi, "<\\/script");
  const styleTag = compiledCss.trim() ? `<style>${compiledCss}</style>` : "";

  if (html.includes("</head>")) {
    html = html.replace("</head>", `${CONSOLE_BRIDGE_SCRIPT}${styleTag}</head>`);
  } else {
    html = `${CONSOLE_BRIDGE_SCRIPT}${styleTag}${html}`;
  }

  if (html.includes("</body>")) {
    html = html.replace("</body>", `<script>${safeJs}</script></body>`);
  } else {
    html = `${html}<script>${safeJs}</script>`;
  }

  return {
    ok: true,
    html,
    diagnostics,
    durationMs: Date.now() - startedAt,
    bundleSizeBytes: Buffer.byteLength(html, "utf8"),
  };
}
