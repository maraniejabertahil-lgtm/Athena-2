import zlib from "zlib";

// Project knowledge library: text and Word (.docx) files, searched with BM25 ranking.
// Stored in server memory for each project, so it is cleared when the server restarts.

export interface KnowledgeFileInfo {
  id: string;
  name: string;
  chunks: string[];
}

const MAX_TEXT_CHARS = 1_000_000;
const MAX_DOCX_BYTES = 3_000_000;
const MAX_CHUNK_CHARS = 800;
const MAX_FILES_PER_PROJECT = 30;

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "your", "with", "this", "that",
  "from", "have", "was", "were", "has", "had", "its", "our", "can", "will", "what",
  "when", "where", "which", "who", "how", "all", "any", "into", "about",
]);

const store = new Map<string, KnowledgeFileInfo[]>();

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const candidate = current ? current + "\n\n" + paragraph : paragraph;
    if (candidate.length > MAX_CHUNK_CHARS && current) {
      chunks.push(current.trim());
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

const INVALID_DOCX = "This does not look like a valid Word (.docx) file.";

function findEndOfCentralDirectory(buf: Buffer): number {
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error(INVALID_DOCX);
}

function xmlToText(xml: string): string {
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Reads word/document.xml from a .docx (a zip archive) using only Node's built-in zlib.
export function docxToText(buf: Buffer): string {
  const eocd = findEndOfCentralDirectory(buf);
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) throw new Error(INVALID_DOCX);
    const method = buf.readUInt16LE(offset + 10);
    const compSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLen);
    if (name === "word/document.xml") {
      const localName = buf.readUInt16LE(localOffset + 26);
      const localExtra = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localName + localExtra;
      const raw = buf.subarray(start, start + compSize);
      if (method !== 0 && method !== 8) {
        throw new Error("This Word file uses an unsupported compression method.");
      }
      const xml = (method === 0 ? raw : zlib.inflateRawSync(raw)).toString("utf8");
      return xmlToText(xml);
    }
    offset += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error("No document text was found in that Word file.");
}

export function addKnowledgeFile(
  projectId: string,
  name: string,
  content: string,
  encoding: "text" | "base64" = "text"
): KnowledgeFileInfo {
  const safeName = (name || "file").replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120);
  const lower = safeName.toLowerCase();
  let text: string;

  if (lower.endsWith(".docx")) {
    const bytes = Buffer.from(content, "base64");
    if (!bytes.length || bytes.length > MAX_DOCX_BYTES) {
      throw new Error("Word file must be under 3 MB.");
    }
    text = docxToText(bytes);
  } else if (/\.(txt|md|json|csv)$/.test(lower)) {
    if (encoding === "base64") throw new Error("Text files must be sent as plain text.");
    text = content;
  } else {
    throw new Error("Supported knowledge files: .txt, .md, .json, .csv and .docx.");
  }

  if (text.length > MAX_TEXT_CHARS) throw new Error("File is larger than 1 MB of text.");
  const chunks = chunkText(text.replace(/\r\n/g, "\n"));
  if (chunks.length === 0) throw new Error("No text was found in that file.");

  const files = store.get(projectId) ?? [];
  if (files.length >= MAX_FILES_PER_PROJECT) {
    throw new Error("A project can hold up to " + MAX_FILES_PER_PROJECT + " knowledge files.");
  }
  const info: KnowledgeFileInfo = { id: crypto.randomUUID(), name: safeName, chunks };
  files.push(info);
  store.set(projectId, files);
  return info;
}

export function listKnowledgeFiles(projectId: string): Array<{ id: string; name: string; chunks: number }> {
  return (store.get(projectId) ?? []).map(f => ({ id: f.id, name: f.name, chunks: f.chunks.length }));
}

export function removeKnowledgeFile(projectId: string, id: string): boolean {
  const files = store.get(projectId) ?? [];
  const next = files.filter(f => f.id !== id);
  store.set(projectId, next);
  return next.length !== files.length;
}

export function searchKnowledge(projectId: string, query: string, limit = 5) {
  const terms = [...new Set(tokenize(query))];
  const files = store.get(projectId) ?? [];
  if (terms.length === 0 || files.length === 0) return [];

  const corpus = files.flatMap(file =>
    file.chunks.map((text, i) => {
      const tokens = tokenize(text);
      return { file: file.name, chunk: i + 1, text, tokens, set: new Set(tokens) };
    })
  );
  const N = corpus.length;
  const avgLen = corpus.reduce((sum, d) => sum + d.tokens.length, 0) / N || 1;
  const K1 = 1.5;
  const B = 0.75;
  const df = new Map(terms.map(t => [t, corpus.filter(d => d.set.has(t)).length]));

  const scored: Array<{ file: string; chunk: number; score: number; text: string }> = [];
  for (const doc of corpus) {
    const freq = new Map<string, number>();
    for (const t of doc.tokens) if (df.has(t)) freq.set(t, (freq.get(t) ?? 0) + 1);
    let score = 0;
    for (const term of terms) {
      const f = freq.get(term);
      if (!f) continue;
      const n = df.get(term) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * doc.tokens.length) / avgLen)));
    }
    if (score > 0) {
      scored.push({ file: doc.file, chunk: doc.chunk, score: Number(score.toFixed(4)), text: doc.text });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
