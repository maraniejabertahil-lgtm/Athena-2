import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const root = path.resolve(process.cwd(), 'data', 'memories');
function fileFor(userId) { if (!/^[a-f0-9-]{36}$/i.test(userId || '')) throw new Error('Invalid user.'); return path.join(root, `${userId}.json`); }
async function readAll(userId) { try { const data = JSON.parse(await fs.readFile(fileFor(userId), 'utf8')); return Array.isArray(data) ? data : []; } catch (e) { if (e.code === 'ENOENT') return []; throw e; } }
async function writeAll(userId, items) { await fs.mkdir(root, { recursive: true, mode: 0o700 }); await fs.writeFile(fileFor(userId), JSON.stringify(items, null, 2), { mode: 0o600 }); }
export async function listMemories(userId) { return readAll(userId); }
export async function addMemory(userId, text) { const value = String(text || '').trim(); if (!value || value.length > 1000) throw new Error('Memory must be 1–1000 characters.'); const items = await readAll(userId); const item = { id: randomUUID(), text: value, createdAt: new Date().toISOString() }; items.push(item); await writeAll(userId, items); return item; }
export async function deleteMemory(userId, id) { const items = await readAll(userId); const next = items.filter(x => x.id !== id); await writeAll(userId, next); return next.length !== items.length; }
export async function memoryContext(userId) { const items = await readAll(userId); return items.length ? '\n\nUser-approved memory notes (use only when relevant):\n' + items.map(x => `- ${x.text}`).join('\n') : ''; }
