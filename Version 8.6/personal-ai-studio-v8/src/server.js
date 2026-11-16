import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { chat } from "./providers/index.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import { runTool, toolDescriptions } from "./tools/registry.js";
import { listMemories, addMemory, deleteMemory, memoryContext } from "./memory.js";
import { addKnowledgeFile, listKnowledge, deleteKnowledge, knowledgeContext } from "./knowledge.js";
import { webSearch } from "./web-search.js";
import { startMcp, mcpStatus, stopMcp } from "./mcp.js";
import { registerUser, loginUser, authenticate, logout, userCount } from "./auth.js";
import { inspectWebPage } from "./browser.js";
import { runSandboxedCode } from "./secure-exec.js";
import { describeImage, generateImage, describeVideo } from "./media.js";
import { listSkills, skillsPromptSection } from "./skills.js";
import { parseSteps, runBrowserSteps } from "./browser-actions.js";
import { configWarnings } from "./config-check.js";

function reasoningGuidance() {
  return config.reasoningLevel === "off" ? "" : "\n\nFor hard problems, reason carefully: restate the goal, list assumptions, check each step, test code against examples before presenting it, and say clearly what is uncertain.";
}
const app = express();
const here = path.dirname(fileURLToPath(import.meta.url));
app.disable("x-powered-by");
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(self), geolocation=()');res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");if(req.secure||req.headers['x-forwarded-proto']==='https')res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');next();});
if(process.env.NODE_ENV==='production' && (config.sessionSecret.length<64 || process.env.COOKIE_SECURE!=='true')) throw new Error('Production startup blocked: use a SESSION_SECRET of at least 64 characters and COOKIE_SECURE=true behind HTTPS.');
app.use(cookieParser());
app.use(express.json({ limit: `${Math.max(1, Math.ceil(Math.max(config.maxRequestBytes, 30_000_000)/1_000_000))}mb` }));
const hits = new Map();
app.use("/api", (req,res,next) => {
  const key=req.ip || "local"; const now=Date.now(); const entry=hits.get(key) || {start:now,count:0};
  if(now-entry.start>60_000){entry.start=now;entry.count=0;} entry.count++; hits.set(key,entry);
  if(entry.count>config.rateLimitPerMinute) return res.status(429).json({error:"Too many requests. Wait a minute and try again."});
  next();
});
app.use(express.static(path.resolve(here, "../public")));

app.get("/api/health", (_req, res) => res.json({
  ok: true, provider: config.provider, setupWarnings: configWarnings(config),
  configured: config.provider === "anthropic"
    ? Boolean(config.anthropicKey && config.anthropicModel)
    : Boolean(config.baseUrl && config.apiKey && config.model),
  skillsLibrary: "user-managed",
  mcp: mcpStatus(),
  features: { automaticReadOnlyTools: true, anthropicToolUse: true, localChatHistory: true, persistentMemory: true, approvalScreen: true, localKnowledgeBase: true, webSearch: Boolean(config.tavilyKey), rateLimiting: true, accountAuthentication: true, skillsSystem: true, imageGeneration: Boolean(config.imageApiKey && config.imageModel), imageUnderstanding: true, videoFrameUnderstanding: true, securityHeaders: true, productionModeGuard: true }
}));

app.post("/api/auth/register", async (req, res) => {
  try {
    if (!config.sessionSecret || config.sessionSecret.length < 32) return res.status(503).json({ error: "Set SESSION_SECRET to a random value of at least 32 characters before creating accounts." });
    if (await userCount() > 0) return res.status(403).json({ error: "Public registration is closed after the first account. Ask the studio owner to create additional accounts." });
    const user = await registerUser(req.body?.email, req.body?.password);
    const auth = await loginUser(req.body.email, req.body.password);
    res.cookie("pas_session", auth.token, { httpOnly: true, sameSite: "strict", secure: process.env.COOKIE_SECURE === "true", maxAge: 7*86400000, path: "/" });
    res.status(201).json({ user: auth.user });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/auth/login", async (req, res) => {
  try {
    if (!config.sessionSecret || config.sessionSecret.length < 32) return res.status(503).json({ error: "Set SESSION_SECRET to a random value of at least 32 characters." });
    const auth = await loginUser(req.body?.email, req.body?.password);
    res.cookie("pas_session", auth.token, { httpOnly: true, sameSite: "strict", secure: process.env.COOKIE_SECURE === "true", maxAge: 7*86400000, path: "/" });
    res.json({ user: auth.user });
  } catch (e) { res.status(401).json({ error: e.message }); }
});
app.post("/api/auth/logout", (req, res) => { logout(req); res.clearCookie("pas_session", { httpOnly: true, sameSite: "strict", path: "/" }); res.json({ ok: true }); });
app.get("/api/auth/status", async (req, res) => res.json({ setupRequired: !config.sessionSecret || config.sessionSecret.length < 32, registrationOpen: await userCount() === 0 }));
app.use("/api", (req, res, next) => {
  if (["/health", "/auth/register", "/auth/login", "/auth/logout", "/auth/status"].includes(req.path)) return next();
  return authenticate(req, res, next);
});

app.get("/api/auth/me", (req, res) => res.json({ user: req.user }));

app.get("/api/workspace", async (_req, res) => {
  try {
    await fs.mkdir(config.workspace, { recursive: true });
    const entries = await fs.readdir(config.workspace, { withFileTypes: true });
    res.json(entries.map(e => ({ name: e.name, type: e.isDirectory() ? "directory" : "file" })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/chat", async (req, res) => {
  try {
    const messages = Array.isArray(req.body.messages) ? req.body.messages.slice(-config.maxHistory) : [];
    if (!messages.length || messages.some(m => !["user", "assistant"].includes(m.role) || !(typeof m.content === "string" || (Array.isArray(m.content) && m.content.length <= 20 && m.content.every(p => p && (p.type === "text" && typeof p.text === "string" || p.type === "image" && typeof p.data === "string" && typeof p.mimeType === "string")))))) {
      return res.status(400).json({ error: "Send valid text or supported image messages." });
    }
    const toolEvents = [];
    const approvedMemory = await memoryContext(req.user.id);
    const relevantKnowledge = await knowledgeContext(messages.filter(m=>m.role === "user").at(-1)?.content || "", req.user.id);
    const reply = await chat({ messages, userId: req.user.id, system: SYSTEM_PROMPT + reasoningGuidance() + await skillsPromptSection() + approvedMemory + relevantKnowledge, onToolEvent: event => toolEvents.push(event) });
    res.json({ reply, toolEvents });
  } catch (e) {
    res.status(502).json({ error: e.message || "AI provider request failed." });
  }
});


app.post("/api/media/image/understand", async (req,res)=>{try{res.json(await describeImage(req.body||{},req.user.id));}catch(e){res.status(400).json({error:e.message});}});
app.post("/api/media/image/generate", async (req,res)=>{try{if(req.headers["x-user-approved"]!=="true")return res.status(403).json({error:"Review and approve image generation first."});res.json(await generateImage(req.body||{}));}catch(e){res.status(400).json({error:e.message});}});
app.post("/api/media/video/understand", async (req,res)=>{try{res.json(await describeVideo(req.body||{},req.user.id));}catch(e){res.status(400).json({error:e.message});}});

app.get("/api/tools", (_req, res) => res.json(toolDescriptions()));
app.get("/api/skills", async (_req, res) => { try { res.json(await listSkills()); } catch (e) { res.status(500).json({ error: e.message }); } });
app.get("/api/mcp", (_req, res) => res.json({ servers: mcpStatus(), note: "Only tools named in MCP_SERVERS allowTools are exposed to the model." }));

app.get("/api/knowledge", async (req,res) => res.json(await listKnowledge(req.user.id)));
app.post("/api/knowledge", async (req,res) => {
  try { res.status(201).json(await addKnowledgeFile(req.user.id,req.body?.name,req.body?.content)); }
  catch(e){ res.status(400).json({error:e.message}); }
});
app.delete("/api/knowledge/:id", async (req,res) => res.json({deleted:await deleteKnowledge(req.user.id,req.params.id)}));
app.post("/api/search", async (req,res) => {
  try { res.json({results:await webSearch(req.body?.query)}); }
  catch(e){ res.status(503).json({error:e.message}); }
});

app.get("/api/memories", async (req, res) => res.json(await listMemories(req.user.id)));
app.post("/api/memories", async (req, res) => {
  try { res.status(201).json(await addMemory(req.user.id, req.body?.text)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.delete("/api/memories/:id", async (req, res) => {
  const deleted = await deleteMemory(req.user.id, req.params.id);
  res.json({ deleted });
});
app.post("/api/approvals/write", async (req, res) => {
  try {
    const result = await runTool("write_workspace_file", req.body || {}, req.headers["x-user-approved"] === "true");
    res.json({ result });
  } catch (e) { res.status(e.message.includes("approval") ? 403 : 400).json({ error: e.message }); }
});
app.post("/api/tools/:name", async (req, res) => {
  const approved = req.headers["x-user-approved"] === "true";
  try {
    const result = await runTool(req.params.name, req.body || {}, approved, req.user.id);
    res.json({ result });
  } catch (e) {
    const status = e.message.includes("approval") ? 403 : 400;
    res.status(status).json({ error: e.message });
  }
});

app.post("/api/browser/inspect", async (req, res) => {
  try { if (req.headers["x-user-approved"] !== "true") return res.status(403).json({ error: "Review and approve this website inspection first." }); res.json({ result: await inspectWebPage(req.body?.url) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/browser/act", async (req, res) => {
  try { if (req.headers["x-user-approved"] !== "true") return res.status(403).json({ error: "Review and approve these browser steps first." }); res.json({ result: await runBrowserSteps(parseSteps(req.body?.steps)) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.post("/api/code/run", async (req, res) => {
  try { if (req.headers["x-user-approved"] !== "true") return res.status(403).json({ error: "Review and approve code execution first." }); res.json({ result: await runSandboxedCode(req.body?.code, req.body?.language) }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
app.get("*", (_req, res) => res.sendFile(path.resolve(here, "../public/index.html")));
await startMcp();
const server = app.listen(config.port, () => {
  console.log(`Personal AI Studio running at http://localhost:${config.port}`);
  for (const warning of configWarnings(config)) console.log(`Setup check: ${warning}`);
});
async function shutdown() { await stopMcp(); server.close(() => process.exit(0)); }
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
