export async function chatOpenAICompatible({ baseUrl, apiKey, model, messages, tools = [], maxTokens = 8192, reasoning = 'off' }) {
  if (!baseUrl || !apiKey || !model) {
    throw new Error("Provider is not configured. Set AI_BASE_URL, AI_API_KEY and AI_MODEL in .env.");
  }
  const normalized = messages.map(m => ({...m, content: Array.isArray(m.content) ? m.content.map(part => part.type === 'image' ? {type:'image_url',image_url:{url:`data:${part.mimeType};base64,${part.data}`}} : part.type === 'text' ? {type:'text',text:part.text} : part) : m.content}));
  const payload = { model, messages: normalized, temperature: 0.4, max_tokens: maxTokens };
  if (reasoning === 'standard') payload.reasoning_effort = 'medium';
  if (reasoning === 'deep') payload.reasoning_effort = 'high';
  if (tools.length) {
    payload.tools = tools;
    payload.tool_choice = "auto";
  }
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `Provider error (${response.status})`);
  return data.choices?.[0]?.message || { role: "assistant", content: "" };
}
