import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHmac, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.js';
const scrypt = promisify(scryptCb);
const store = path.resolve(process.cwd(), 'data', 'auth.json');
const sessionStore = path.resolve(process.cwd(), 'data', 'sessions.json');
function readSessions(){try{return new Map(Object.entries(JSON.parse(fsSync.readFileSync(sessionStore,'utf8'))));}catch{return new Map();}}
const sessions = readSessions();
function saveSessions(){fsSync.mkdirSync(path.dirname(sessionStore),{recursive:true,mode:0o700});fsSync.writeFileSync(sessionStore,JSON.stringify(Object.fromEntries(sessions)),{mode:0o600});try{fsSync.chmodSync(sessionStore,0o600);}catch{}}
async function read() { try { return JSON.parse(await fs.readFile(store, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return { users: [] }; throw e; } }
async function write(data) { await fs.mkdir(path.dirname(store), { recursive: true, mode: 0o700 }); await fs.writeFile(store, JSON.stringify(data, null, 2), { mode: 0o600 }); }
export async function registerUser(email, password) {
  email = String(email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new Error('Enter a valid email address.');
  if (typeof password !== 'string' || password.length < 12 || password.length > 200) throw new Error('Password must be 12–200 characters.');
  const db = await read(); if (db.users.some(u => u.email === email)) throw new Error('An account with this email already exists.');
  const salt = randomBytes(16).toString('hex'); const hash = (await scrypt(password, salt, 64)).toString('hex');
  const user = { id: randomUUID(), email, salt, hash, createdAt: new Date().toISOString() };
  db.users.push(user); await write(db); return { id: user.id, email: user.email };
}
export async function loginUser(email, password) {
  const db = await read(); const user = db.users.find(u => u.email === String(email || '').trim().toLowerCase());
  if (!user || typeof password !== 'string') throw new Error('Email or password is incorrect.');
  const candidate = await scrypt(password, user.salt, 64);
  if (!timingSafeEqual(candidate, Buffer.from(user.hash, 'hex'))) throw new Error('Email or password is incorrect.');
  const token = randomBytes(32).toString('base64url'); sessions.set(createHmac('sha256', config.sessionSecret).update(token).digest('hex'), { userId: user.id, expires: Date.now() + 7 * 86400000 }); saveSessions();
  return { token, user: { id: user.id, email: user.email } };
}
export function authenticate(req, res, next) {
  const token = req.cookies?.pas_session;
  if (!token) return res.status(401).json({ error: 'Please sign in.' });
  const key = createHmac('sha256', config.sessionSecret).update(token).digest('hex'); const session = sessions.get(key);
  if (!session || session.expires < Date.now()) { sessions.delete(key); saveSessions(); res.clearCookie('pas_session'); return res.status(401).json({ error: 'Your session expired. Please sign in again.' }); }
  req.user = { id: session.userId }; next();
}
export function logout(req) { const token = req.cookies?.pas_session; if (token) { sessions.delete(createHmac('sha256', config.sessionSecret).update(token).digest('hex')); saveSessions(); } }
export async function userCount() { return (await read()).users.length; }
