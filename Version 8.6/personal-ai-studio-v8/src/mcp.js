import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { config } from './config.js';

const connections = new Map();
const MAX_RESULT_CHARS = 30000;
let started = false;

function parseServers() {
  if (!config.mcpServersJson) return [];
  let value;
  try { value = JSON.parse(config.mcpServersJson); } catch { throw new Error('MCP_SERVERS must be valid JSON.'); }
  if (!Array.isArray(value)) throw new Error('MCP_SERVERS must be a JSON array.');
  return value;
}

export async function startMcp() {
  if (started) return;
  started = true;
  for (const spec of parseServers()) {
    if (!spec || typeof spec.name !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(spec.name)) continue;
    if (!Array.isArray(spec.allowTools) || !spec.allowTools.length) continue;
    const client = new Client({ name: 'personal-ai-studio', version: '5.0.0' });
    let transport;
    try {
      if (spec.transport === 'stdio') {
        if (typeof spec.command !== 'string' || !spec.command.trim()) continue;
        transport = new StdioClientTransport({ command: spec.command, args: Array.isArray(spec.args) ? spec.args : [], env: { ...process.env, ...(spec.env || {}) } });
      } else if (spec.transport === 'http') {
        if (typeof spec.url !== 'string' || !spec.url.startsWith('https://') && !spec.url.startsWith('http://localhost')) continue;
        transport = new StreamableHTTPClientTransport(new URL(spec.url), { requestInit: { headers: spec.headers || {} } });
      } else continue;
      await client.connect(transport);
      const listed = await client.listTools();
      const allowed = new Set(spec.allowTools);
      const tools = (listed.tools || []).filter(t => allowed.has(t.name));
      connections.set(spec.name, { client, transport, tools });
      console.log(`MCP ${spec.name}: connected; ${tools.length} explicitly allowed tools.`);
    } catch (error) {
      console.warn(`MCP ${spec.name}: connection failed: ${error.message}`);
      try { await transport?.close(); } catch {}
    }
  }
}

export function mcpToolDescriptions() {
  const out = [];
  for (const [server, entry] of connections) for (const tool of entry.tools) {
    const name = `mcp_${server}_${tool.name}`;
    const description = `[MCP server ${server}] ${String(tool.description || tool.title || tool.name).slice(0, 500)}`;
    out.push({ type: 'function', function: { name, description, parameters: tool.inputSchema || { type: 'object', properties: {} } } });
  }
  return out;
}

export async function runMcpTool(fullName, args) {
  if (!fullName.startsWith('mcp_')) throw new Error('Unknown MCP tool.');
  const rest = fullName.slice(4); const split = rest.indexOf('_');
  if (split < 1) throw new Error('Invalid MCP tool name.');
  const server = rest.slice(0, split); const toolName = rest.slice(split + 1);
  const entry = connections.get(server);
  if (!entry || !entry.tools.some(t => t.name === toolName)) throw new Error('MCP tool is not connected or not allowlisted.');
  const result = await entry.client.callTool({ name: toolName, arguments: args || {} });
  const safe = JSON.stringify(result);
  return safe.length > MAX_RESULT_CHARS ? safe.slice(0, MAX_RESULT_CHARS) + '…[truncated]' : result;
}

export function mcpStatus() {
  return [...connections].map(([name, entry]) => ({ name, connected: true, allowedTools: entry.tools.map(t => t.name) }));
}

export async function stopMcp() {
  for (const entry of connections.values()) { try { await entry.client.close(); } catch {} }
  connections.clear(); started = false;
}
