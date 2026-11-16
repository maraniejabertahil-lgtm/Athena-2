import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  AGENT_TOOL_DECLARATIONS,
  buildAgentSystemInstruction,
  computeFileOperations,
  executeAgentTool,
  formatToolLabel,
  type AgentStepEvent,
  type StudioAssistParams,
} from "./gemini.ts";

const MAX_AGENT_TURNS = 12;

function jsonSchema(value: any): any {
  if (!value || typeof value !== "object") return { type: "string" };
  const rawType = String(value.type ?? "object").toLowerCase();
  const result: Record<string, any> = { type: rawType };
  if (value.description) result.description = value.description;
  if (value.enum) result.enum = value.enum;
  if (value.items) result.items = jsonSchema(value.items);
  if (value.properties) {
    result.properties = Object.fromEntries(
      Object.entries(value.properties).map(([key, schema]) => [key, jsonSchema(schema)])
    );
    result.required = Array.isArray(value.required) ? value.required : [];
    result.additionalProperties = false;
  }
  return result;
}

function providerTools() {
  return AGENT_TOOL_DECLARATIONS.map((tool: any) => ({
    name: tool.name,
    description: tool.description,
    input_schema: jsonSchema(tool.parameters),
  }));
}

function openAITools() {
  return AGENT_TOOL_DECLARATIONS.map((tool: any) => {
    const parameters = jsonSchema(tool.parameters);
    const properties = parameters.properties ?? {};
    return {
      type: "function" as const,
      name: tool.name,
      description: tool.description,
      strict: true,
      parameters: {
        ...parameters,
        properties,
        required: Object.keys(properties),
        additionalProperties: false,
      },
    };
  });
}

function workspacePrompt(params: StudioAssistParams) {
  const files = Object.entries(params.files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, value]) => `- ${path} (${value.split("\n").length} lines)`);
  const active = params.activeFile && params.files[params.activeFile] !== undefined
    ? params.files[params.activeFile].length <= 12000
      ? "\nCurrent Active File (" + params.activeFile + "):\n" + params.files[params.activeFile]
      : `\nCurrent Active File: ${params.activeFile} (use view_file to inspect)`
    : "";
  return `Workspace Files (${files.length}):\n${files.join("\n")}${active}\n\nUser Request:\n${params.prompt}`;
}

function historyText(params: StudioAssistParams) {
  return (params.history ?? []).slice(-20).map((message) => ({
    role: message.role === "assistant" || message.role === "model" ? "assistant" : "user",
    content: `${message.attachments?.length ? "[Earlier attachments: " + message.attachments.map((a) => a.name || a.mimeType).join(", ") + "]\n" : ""}${message.content ?? ""}`,
  }));
}

function anthropicCurrentContent(params: StudioAssistParams) {
  const blocks: any[] = [];
  for (const attachment of params.attachments ?? []) {
    if (!attachment.dataBase64) continue;
    if (attachment.mimeType.startsWith("image/")) {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: attachment.mimeType, data: attachment.dataBase64 },
      });
    } else if (attachment.mimeType === "application/pdf") {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: attachment.dataBase64 },
      });
    } else {
      blocks.push({ type: "text", text: `Attached file: ${attachment.name || attachment.mimeType} (file content is not directly supported by this provider adapter).` });
    }
  }
  blocks.push({ type: "text", text: workspacePrompt(params) });
  return blocks;
}

function openAICurrentContent(params: StudioAssistParams) {
  const content: any[] = [{ type: "input_text", text: workspacePrompt(params) }];
  for (const attachment of params.attachments ?? []) {
    if (!attachment.dataBase64) continue;
    if (attachment.mimeType.startsWith("image/")) {
      content.push({
        type: "input_image",
        image_url: `data:${attachment.mimeType};base64,${attachment.dataBase64}`,
      });
    } else if (attachment.mimeType === "application/pdf") {
      content.push({
        type: "input_file",
        filename: attachment.name || "attachment.pdf",
        file_data: `data:application/pdf;base64,${attachment.dataBase64}`,
      });
    } else {
      content.push({ type: "input_text", text: `Attached file: ${attachment.name || attachment.mimeType} (not passed as binary to this provider).` });
    }
  }
  return content;
}

export async function runProviderAssistStream(
  params: StudioAssistParams,
  callbacks: {
    onStatus: (status: string) => void;
    onThoughts: (thoughts: string) => void;
    onContent: (content: string) => void;
    onStep?: (step: AgentStepEvent) => void;
    signal?: AbortSignal;
  }
) {
  const startedAt = Date.now();
  const workingFiles = { ...params.files };
  const steps: AgentStepEvent[] = [];
  let finalText = "";
  let totalTokens = 0;
  const system = buildAgentSystemInstruction(params);
  const tools = providerTools();

  const runTool = async (name: string, args: Record<string, unknown>, turn: number) => {
    const id = `${turn}-${name}-${steps.length}`;
    const running: AgentStepEvent = {
      id,
      toolName: name,
      label: formatToolLabel(name, args),
      status: "running",
    };
    steps.push(running);
    callbacks.onStep?.(running);
    callbacks.onStatus(`${running.label}...`);
    const result = await executeAgentTool(name, args, workingFiles, params.projectId || "default");
    const done: AgentStepEvent = {
      ...running,
      status: result.ok ? "done" : "error",
      detail: result.detail,
    };
    steps[steps.length - 1] = done;
    callbacks.onStep?.(done);
    return result.output;
  };

  if (params.model.startsWith("claude-")) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is missing. Add it to your server environment variables.");
    }
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const messages: any[] = historyText(params);
    messages.push({ role: "user", content: anthropicCurrentContent(params) });

    for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
      if (callbacks.signal?.aborted) break;
      callbacks.onStatus(turn === 0 ? "Connecting to Claude..." : "Claude is working...");
      const response = await client.messages.create({
        model: params.model,
        max_tokens: Math.min(32000, Math.max(1024, Number(process.env.MAX_REPLY_TOKENS || 8192))),
        system,
        messages,
        tools: tools as any,
      }, callbacks.signal ? { signal: callbacks.signal } : undefined);
      totalTokens += (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);
      const textParts = response.content.filter((part: any) => part.type === "text").map((part: any) => part.text);
      if (textParts.length) {
        finalText = [finalText, textParts.join("")].filter(Boolean).join("\n\n");
        callbacks.onContent(finalText);
      }
      const calls = response.content.filter((part: any) => part.type === "tool_use");
      if (!calls.length) break;
      messages.push({ role: "assistant", content: response.content });
      const results = [];
      for (const call of calls as any[]) {
        if (callbacks.signal?.aborted) break;
        const output = await runTool(call.name, call.input ?? {}, turn);
        results.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(output),
        });
      }
      messages.push({ role: "user", content: results });
    }
  } else if (params.model.startsWith("gpt-")) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is missing. Add it to your server environment variables.");
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const input: any[] = historyText(params).map((message) => ({
      role: message.role,
      content: [{ type: message.role === "assistant" ? "output_text" : "input_text", text: message.content }],
    }));
    input.push({ role: "user", content: openAICurrentContent(params) });

    for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
      if (callbacks.signal?.aborted) break;
      callbacks.onStatus(turn === 0 ? "Connecting to OpenAI..." : "OpenAI is working...");
      const response: any = await client.responses.create({
        model: params.model,
        instructions: system,
        input,
        tools: openAITools() as any,
        max_output_tokens: Math.min(32000, Math.max(1024, Number(process.env.MAX_REPLY_TOKENS || 8192))),
      }, callbacks.signal ? { signal: callbacks.signal } : undefined);
      totalTokens += response.usage?.total_tokens ?? 0;
      if (response.output_text) {
        finalText = [finalText, response.output_text].filter(Boolean).join("\n\n");
        callbacks.onContent(finalText);
      }
      const calls = (response.output ?? []).filter((item: any) => item.type === "function_call");
      if (!calls.length) break;
      input.push(...response.output);
      for (const call of calls) {
        if (callbacks.signal?.aborted) break;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(call.arguments || "{}"); } catch { args = {}; }
        const output = await runTool(call.name, args, turn);
        input.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(output),
        });
      }
    }
  } else {
    throw new Error(`Unsupported provider model: ${params.model}`);
  }

  const { operations, summary } = computeFileOperations(params.files, workingFiles);
  return {
    explanation: finalText.trim() || (operations.length ? `Completed ${operations.length} file changes.` : "Done."),
    summary,
    operations,
    agentSteps: steps,
    thoughts: "",
    groundingSources: [],
    modelUsed: params.model,
    latencyMs: Date.now() - startedAt,
    totalTokens: totalTokens || undefined,
  };
}
