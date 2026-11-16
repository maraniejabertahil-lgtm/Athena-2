import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
export const config = {
  port: Number(process.env.PORT || 3000),
  sessionSecret: process.env.SESSION_SECRET || "",
  provider: process.env.AI_PROVIDER || "openai-compatible",
  baseUrl: (process.env.AI_BASE_URL || "").replace(/\/+$/, ""),
  apiKey: process.env.AI_API_KEY || "",
  model: process.env.AI_MODEL || "",
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "",
  workspace: path.resolve(process.cwd(), process.env.WORKSPACE_DIR || "./workspace"),
  skills: path.resolve(process.cwd(), "skills"),
  tavilyKey: process.env.TAVILY_API_KEY || "",
  maxRequestBytes: Number(process.env.MAX_REQUEST_BYTES || 5_000_000),
  knowledgeDir: path.resolve(process.cwd(), process.env.KNOWLEDGE_DIR || "./knowledge"),
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE || 30),
  mcpServersJson: process.env.MCP_SERVERS || "",
  imageBaseUrl: (process.env.IMAGE_API_BASE_URL || process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
  imageApiKey: process.env.IMAGE_API_KEY || process.env.AI_API_KEY || "",
  imageModel: process.env.IMAGE_MODEL || "",
  ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
  maxReplyTokens: Math.min(32000, Math.max(256, Number(process.env.MAX_REPLY_TOKENS || 8192))),
  maxHistory: Math.min(200, Math.max(10, Number(process.env.MAX_HISTORY_MESSAGES || 60))),
  autoRunCode: process.env.AUTO_RUN_CODE === "true",
  reasoningLevel: ["off", "standard", "deep"].includes(process.env.REASONING_LEVEL) ? process.env.REASONING_LEVEL : "off"
};
