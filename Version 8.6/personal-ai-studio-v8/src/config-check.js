// Plain-language checks of the .env settings. Shown at startup and on the health page.
export function configWarnings(c) {
  const w = [];
  if (c.provider === "anthropic") {
    if (!c.anthropicKey) w.push("AI_PROVIDER is anthropic, but ANTHROPIC_API_KEY is empty.");
    if (!c.anthropicModel) w.push("ANTHROPIC_MODEL is empty. Use the exact model name from Anthropic's model list.");
  } else if (c.provider === "openai-compatible") {
    if (!c.baseUrl) w.push("AI_BASE_URL is empty. For Gemini, copy the endpoint from Google's current documentation.");
    if (!c.apiKey) w.push("AI_API_KEY is empty.");
    if (!c.model) w.push("AI_MODEL is empty. Copy the exact model name from your provider.");
  } else {
    w.push(`AI_PROVIDER must be "anthropic" or "openai-compatible", not "${c.provider}".`);
  }
  if (!c.sessionSecret || c.sessionSecret.length < 32) w.push("SESSION_SECRET should be at least 32 characters. Account sign-in needs it.");
  if (c.autoRunCode) w.push("AUTO_RUN_CODE is on: the assistant may run code in the sandbox without a click.");
  if (c.reasoningLevel === "deep") w.push("REASONING_LEVEL is deep: answers use more time and tokens.");
  return w;
}
