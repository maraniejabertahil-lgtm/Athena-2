export async function chatAnthropic({ apiKey, model, messages, system = '', tools = [], runTool, onToolEvent = () => {}, maxTokens = 8192, maxRounds = 5, reasoning = 'off' }) {
  const thinkingBudget = { standard: 2000, deep: 8000 }[reasoning] || 0;
  if (!apiKey || !model) throw new Error('Set ANTHROPIC_API_KEY and ANTHROPIC_MODEL in .env.');
  const thread = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: Array.isArray(m.content) ? m.content.map(p => p.type === 'image' ? ({type:'image',source:{type:'base64',media_type:p.mimeType,data:p.data}}) : p.type === 'text' ? ({type:'text',text:p.text}) : p) : m.content }));
  for (let round = 0; round < maxRounds; round++) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens + thinkingBudget, system, messages: thread, ...(tools.length ? { tools } : {}), ...(thinkingBudget ? { thinking: { type: 'enabled', budget_tokens: thinkingBudget } } : {}) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || `Anthropic error (${response.status})`);
    const blocks = data.content || [];
    const calls = blocks.filter(x => x.type === 'tool_use');
    if (!calls.length) return { role: 'assistant', content: blocks.filter(x => x.type === 'text').map(x => x.text).join('\n') };
    thread.push({ role: 'assistant', content: blocks });
    const results = [];
    for (const call of calls) {
      onToolEvent({ name: call.name, status: 'running' });
      try { const result = await runTool(call.name, call.input || {}, false); results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(result) }); onToolEvent({ name: call.name, status: 'complete' }); }
      catch (error) { results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: error.message }); onToolEvent({ name: call.name, status: 'error' }); }
    }
    thread.push({ role: 'user', content: results });
  }
  return { role: 'assistant', content: 'I reached the tool-use limit for this turn. Please ask me to continue.' };
}
