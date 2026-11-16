import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

// Skills are read-only instruction files. Loading one never runs code
// and never grants new tools or permissions.
const MAX_SKILL_BYTES = 300_000;
const MAX_RETURN_CHARS = 60_000;

let cache = null;

// Reads the "key: value" frontmatter used at the top of each SKILL.md.
// Supports quoted values and folded (>) or literal (|) multi-line values.
export function parseFrontmatter(text) {
  const src = String(text || "").replace(/\r\n/g, "\n");
  if (!src.startsWith("---\n")) return { meta: {}, body: src };
  const end = src.indexOf("\n---", 4);
  if (end === -1) return { meta: {}, body: src };
  const header = src.slice(4, end).split("\n");
  const body = src.slice(end + 4).replace(/^\n/, "");
  const meta = {};
  for (let i = 0; i < header.length; i++) {
    const m = header[i].match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const raw = m[2].trim();
    let value = raw;
    if (["|", ">", "|-", ">-"].includes(raw)) {
      const parts = [];
      while (i + 1 < header.length && (/^\s+/.test(header[i + 1]) || header[i + 1] === "")) {
        i++;
        parts.push(header[i].trim());
      }
      value = raw.startsWith(">")
        ? parts.filter(Boolean).join(" ")
        : parts.join("\n").trim();
    } else if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
      value = raw.slice(1, -1);
    } else if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) {
      value = raw.slice(1, -1).replace(/''/g, "'");
    }
    meta[key] = value;
  }
  return { meta, body };
}

async function scanSkills() {
  const entries = await fs.readdir(config.skills, { withFileTypes: true }).catch(() => []);
  const list = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = path.join(config.skills, entry.name, "SKILL.md");
    const stat = await fs.stat(file).catch(() => null);
    if (!stat || !stat.isFile() || stat.size > MAX_SKILL_BYTES) continue;
    const { meta, body } = parseFrontmatter(await fs.readFile(file, "utf8"));
    list.push({
      id: entry.name,
      name: meta.name || entry.name,
      description: meta.description || "",
      body: body.trim()
    });
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

export async function loadSkills() {
  if (!cache) {
    const list = await scanSkills();
    cache = { list, byId: new Map(list.map(s => [s.id, s])) };
  }
  return cache;
}

export function reloadSkills() {
  cache = null;
}

export async function listSkills() {
  const { list } = await loadSkills();
  return list.map(({ id, name, description }) => ({ id, name, description }));
}

// Accepts a skill id (exact folder name) or a display name.
export async function readSkill(key) {
  const { list, byId } = await loadSkills();
  const wanted = String(key || "").trim();
  let skill = byId.get(wanted);
  if (!skill) {
    const matches = list.filter(s => s.name === wanted);
    if (matches.length > 1) {
      throw new Error(`More than one skill is named "${wanted}". Use one of these ids: ${matches.map(s => s.id).join(", ")}`);
    }
    skill = matches[0];
  }
  if (!skill) throw new Error("No skill matches that name or id. Call list_skills first.");
  const instructions = skill.body.length > MAX_RETURN_CHARS
    ? skill.body.slice(0, MAX_RETURN_CHARS) + "\n\n[Skill text truncated for length.]"
    : skill.body;
  return { id: skill.id, name: skill.name, instructions };
}

// A short list of names for the system prompt. Full text is loaded on demand.
export async function skillsPromptSection() {
  const { list } = await loadSkills();
  if (!list.length) return "";
  const names = list.map(s => s.name).join(", ");
  return `\n\nSkills library (user-managed; use load_skill with a skill's name to read its full instructions before following one): ${names}.`;
}
