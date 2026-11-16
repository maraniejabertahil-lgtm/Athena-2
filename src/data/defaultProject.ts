import {
  DevicePreset,
  StudioModelId,
  StudioPlugin,
  StudioProject,
  StudioSkill,
  ThinkingDepth,
} from "../types/studio.ts";

export interface ModelOption {
  id: StudioModelId;
  name: string;
  shortName: string;
  tagline: string;
  supportedThinkingLevels: ThinkingDepth[];
  defaultThinkingLevel: ThinkingDepth;
}

export const STUDIO_MODELS: ModelOption[] = [
  {
    id: "gemini-4-hydrogen",
    name: "Gemini 4 Hydrogen",
    shortName: "Gemini 4 Hydrogen",
    tagline: "Flagship reasoning & full-stack generation",
    supportedThinkingLevels: ["LOW", "MEDIUM", "HIGH", "XHIGH"],
    defaultThinkingLevel: "LOW",
  },
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash Lite",
    shortName: "3.5 Flash Lite",
    tagline: "Balanced high-throughput coding & fast UI edits",
    supportedThinkingLevels: ["MINIMAL", "LOW", "MEDIUM", "HIGH"],
    defaultThinkingLevel: "LOW",
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    shortName: "3.1 Flash Lite",
    tagline: "Ultra-fast code edits & iterations",
    supportedThinkingLevels: ["MINIMAL", "LOW", "MEDIUM", "HIGH"],
    defaultThinkingLevel: "LOW",
  },
];

export const DEFAULT_PLUGINS: StudioPlugin[] = [
  {
    id: "responsive-guard",
    name: "Responsive Layout Guard",
    description: "Enforces mobile, tablet, and desktop viewport integrity with zero horizontal overflow.",
    instruction:
      "Plugin [Responsive Layout Guard]: Verify all layouts adapt cleanly at 320px, 390px, 768px, and 1440px widths with zero horizontal scrollbars or clipped buttons.",
  },
  {
    id: "a11y-auditor",
    name: "Accessibility & Contrast",
    description: "Enforces WCAG AA contrast, semantic landmarks, aria-labels, and focus-visible states.",
    instruction:
      "Plugin [Accessibility & Contrast]: Use semantic HTML (<header>, <main>, <nav>, <button>), ensure WCAG AA contrast, include descriptive alt text and aria-labels on icon buttons.",
  },
  {
    id: "code-hygiene",
    name: "Modular Code Hygiene",
    description: "Keeps components cleanly split across src/components and removes dead stubs.",
    instruction:
      "Plugin [Modular Code Hygiene]: Extract reusable UI into focused components under src/components/, keep imports accurate, and never leave TODO stubs or unused variables.",
  },
  {
    id: "seo-meta",
    name: "SEO & Meta Tags",
    description: "Keeps index.html title, description, and OpenGraph tags synced with the project.",
    instruction:
      "Plugin [SEO & Meta Tags]: Ensure index.html includes accurate <title>, meta description, and viewport tags matching the generated site.",
  },
];

export const DEFAULT_SKILLS: StudioSkill[] = [
  {
    id: "ui-ux-designer",
    name: "UI/UX Systems Designer",
    description: "Sharp typographic hierarchy, balanced spacing, and restrained color discipline.",
    instructions:
      "Skill [UI/UX Systems Designer]: Craft clean editorial hierarchy, generous spacing, subtle 1px borders, cohesive color ratios (60% neutral, 30% surface, 10% accent), and crisp interactive hover/focus states.",
  },
  {
    id: "react-architect",
    name: "React & State Architect",
    description: "Clean hooks, predictable state updates, and modular component boundaries.",
    instructions:
      "Skill [React & State Architect]: Structure state cleanly with React hooks, prevent unnecessary re-renders, handle empty/loading/error states explicitly, and keep props strongly structured.",
  },
  {
    id: "forms-validation",
    name: "Forms & Validation",
    description: "Accessible form controls with inline validation and clear submission feedback.",
    instructions:
      "Skill [Forms & Validation]: Provide labeled inputs, inline validation messages, disabled loading states on submit buttons, and clear confirmation feedback.",
  },
  {
    id: "data-dashboard",
    name: "Data & Dashboard Grid",
    description: "Tabular numerals, sortable/filterable tables, and crisp metric alignment.",
    instructions:
      "Skill [Data & Dashboard Grid]: Use tabular-nums for all metrics, align numbers right and text left in tables, include client-side search/filter controls, and render clean SVG charts when data visualizations are requested.",
  },
];

export const DEVICE_PRESETS: DevicePreset[] = [
  { id: "desktop", label: "Desktop", width: 1440, height: 900 },
  { id: "laptop", label: "Laptop", width: 1366, height: 768 },
  { id: "tablet", label: "Tablet", width: 768, height: 1024 },
  { id: "mobile", label: "Mobile", width: 390, height: 844 },
  { id: "small-mobile", label: "Small Mobile", width: 320, height: 640 },
  { id: "custom", label: "Custom", width: 1024, height: 720 },
];

export const ZOOM_OPTIONS = [25, 50, 75, 100] as const;

export const DEFAULT_PROJECT_FILES: Record<string, string> = {
  "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Studio Starter App</title>
  </head>
  <body class="bg-slate-950 text-slate-100 antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
  "package.json": `{
  "name": "my-project",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "lucide-react": "^0.546.0",
    "react": "^19.0.1",
    "react-dom": "^19.0.1"
  }
}
`,
  "public/favicon.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="8" fill="#191C23"/>
  <path d="M9 10h4v12H9V10zm10 0h4v12h-4V10zm-6 4h6v4h-6v-4z" fill="#4285F4"/>
</svg>
`,
  "src/index.css": `@import "tailwindcss";

body {
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
`,
  "src/main.jsx": `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
  "src/App.jsx": `import React, { useState } from "react";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";

export default function App() {
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header
        activeSection={activeSection}
        onNavigate={setActiveSection}
      />
      <main className="flex-1">
        <Home activeSection={activeSection} />
      </main>
      <Footer />
    </div>
  );
}
`,
  "src/components/Button.jsx": `import React from "react";

export default function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}) {
  const styles =
    variant === "primary"
      ? "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500"
      : "bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700";

  return (
    <button
      className={\`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer \${styles} \${className}\`}
      {...props}
    >
      {children}
    </button>
  );
}
`,
  "src/components/Header.jsx": `import React, { useState } from "react";
import { Menu, X } from "lucide-react";
import Button from "./Button.jsx";

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "architecture", label: "Architecture" },
  { id: "showcase", label: "Showcase" },
];

export default function Header({ activeSection, onNavigate }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <span className="text-base font-semibold tracking-tight text-white">
          Northstar Labs
        </span>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={\`transition-colors cursor-pointer \${
                activeSection === item.id
                  ? "text-white font-medium"
                  : "text-slate-400 hover:text-slate-200"
              }\`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button onClick={() => onNavigate("showcase")}>
            Explore Demo
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Toggle menu"
          className="md:hidden p-2 rounded-lg text-slate-300 hover:bg-slate-800 cursor-pointer"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950 px-4 py-3 space-y-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id);
                setMenuOpen(false);
              }}
              className="block w-full text-left py-2 text-sm text-slate-200 hover:text-white cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
`,
  "src/components/Footer.jsx": `import React from "react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <span>Northstar Labs · Interactive Web Starter</span>
        <span>Built inside Hydrogen AI Studio</span>
      </div>
    </footer>
  );
}
`,
  "src/pages/Home.jsx": `import React, { useState } from "react";
import { ArrowRight, Check, Layers, Monitor, Zap } from "lucide-react";
import Button from "../components/Button.jsx";

const CAPABILITIES = [
  {
    icon: Layers,
    title: "Modular Components",
    desc: "Clean React component tree ready to extend through natural language prompts.",
  },
  {
    icon: Monitor,
    title: "Responsive Grid",
    desc: "Adapts cleanly across 1440px desktops, tablets, and 390px mobile viewports.",
  },
  {
    icon: Zap,
    title: "Instant Rebuild",
    desc: "Every code edit or AI update compiles and refreshes live in milliseconds.",
  },
];

export default function Home({ activeSection }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    console.log("Subscribed:", email);
    setSubmitted(true);
    setEmail("");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-16">
      <section className="max-w-3xl space-y-6">
        <div className="text-xs font-medium text-blue-400">
          {activeSection === "architecture"
            ? "System Architecture"
            : activeSection === "showcase"
            ? "Interactive Preview"
            : "Live Studio Workspace"}
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
          Build, inspect, and ship responsive web apps from one workspace.
        </h1>
        <p className="text-base sm:text-lg text-slate-400 leading-relaxed">
          Use the AI assistant on the left to redesign this page, add new routes,
          connect interactive workflows, or edit any file directly in Monaco Editor.
        </p>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row gap-3 max-w-md pt-2"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setSubmitted(false);
            }}
            placeholder="you@studio.dev"
            className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
          <Button type="submit">
            {submitted ? (
              <>
                <Check className="w-4 h-4" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <span>Get Updates</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {CAPABILITIES.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-3"
            >
              <Icon className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-semibold text-white">
                {item.title}
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                {item.desc}
              </p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
`,
};

export const QUICK_AI_PROMPTS = [
  "Redesign this app into a modern SaaS analytics landing page with pricing tiers",
  "Add a Dark/Light theme switcher to Header.jsx",
  "Create a new src/pages/Dashboard.jsx with interactive charts and stats",
  "Audit all components for responsive mobile layout issues and fix them",
];

export function createNewProject(name = "my-project"): StudioProject {
  const convId = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    name,
    files: { ...DEFAULT_PROJECT_FILES },
    openTabs: ["src/App.jsx", "src/pages/Home.jsx"],
    activeFile: "src/App.jsx",
    conversations: [
      {
        id: convId,
        title: "Project Setup",
        messages: [],
        updatedAt: Date.now(),
      },
    ],
    activeConversationId: convId,
    versions: [
      {
        id: crypto.randomUUID(),
        label: "Initial Starter Template",
        createdAt: Date.now(),
        files: { ...DEFAULT_PROJECT_FILES },
        changedFilesCount: Object.keys(DEFAULT_PROJECT_FILES).length,
      },
    ],
    model: "gemini-4-hydrogen",
    thinkingLevel: "LOW",
    useSearch: false,
    useUrlContext: false,
    autoApplyChanges: true,
    fallbackOnQuota: true,
    systemInstruction: "",
    enabledPluginIds: ["responsive-guard", "code-hygiene"],
    enabledSkillIds: ["ui-ux-designer"],
    githubRepo: null,
    updatedAt: Date.now(),
  };
}
