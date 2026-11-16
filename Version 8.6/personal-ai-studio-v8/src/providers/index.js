import { config } from '../config.js';
import { chatOpenAICompatible } from './openai-compatible.js';
import { chatAnthropic } from './anthropic.js';
import { runTool, modelToolDescriptions, anthropicToolDescriptions } from '../tools/registry.js';
import { mcpToolDescriptions, runMcpTool } from '../mcp.js';
const MAX_TOOL_ROUNDS = 8;
export async function chat({ messages, system, userId, onToolEvent = () => {} }) {
  const mcpTools = mcpToolDescriptions();
  const allRunTool = async (name, args, approved = false) => name.startsWith('mcp_') ? runMcpTool(name, args) : runTool(name, args, approved, userId);
  if (config.provider === 'anthropic') return chatAnthropic({ apiKey: config.anthropicKey, model: config.anthropicModel, messages, system, maxTokens: config.maxReplyTokens, maxRounds: MAX_TOOL_ROUNDS, reasoning: config.reasoningLevel, tools: [...anthropicToolDescriptions(), ...mcpTools.map(t => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters }))], runTool: allRunTool, onToolEvent });
  const thread = [{ role: 'system', content: system }, ...messages];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const reply = await chatOpenAICompatible({ baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model, messages: thread, maxTokens: config.maxReplyTokens, reasoning: config.reasoningLevel, tools: [...modelToolDescriptions(), ...mcpTools] });
    const calls = reply.tool_calls || [];
    if (!calls.length) return { role: 'assistant', content: reply.content || '' };
    thread.push(reply);
    for (const call of calls) {
      const name = call.function?.name; let args;
      try { args = JSON.parse(call.function?.arguments || '{}'); } catch { args = {}; }
      onToolEvent({ name, status: 'running' });
      try { const result = await allRunTool(name, args, false); thread.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) }); onToolEvent({ name, status: 'complete' }); }
      catch (error) { thread.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: error.message }) }); onToolEvent({ name, status: 'error' }); }
    }
  }
  return { role: 'assistant', content: 'I reached the tool-use limit for this turn. Please ask me to continue.' };
}
