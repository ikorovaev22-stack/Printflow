// One call to the model through a gateway (clodex, Vercel AI Gateway, OpenRouter…). Claude models ("claude-…") go
// through the Anthropic Messages API at {base}/messages, the rest through the OpenAI-compatible {base}/chat/completions.
// Node-only, no "server-only" marker so scripts/ai-compare.ts can use it; the app calls it through assistant-server.ts
import Anthropic from "@anthropic-ai/sdk";
import type { ModelMessage } from "@/lib/assistant";

export type Completion = { text: string; tokensIn: number | null; tokensOut: number | null };

export class AiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`AI API ${status}: ${detail}`);
  }
}

type Request = { baseUrl: string; apiKey: string; model: string; messages: ModelMessage[]; temperature?: number; timeoutMs?: number };

export const usesMessagesApi = (model: string) => model.startsWith("claude-");

export function chatCompletion(req: Request): Promise<Completion> {
  return usesMessagesApi(req.model) ? claudeCompletion(req) : openAiCompletion(req);
}

async function openAiCompletion({ baseUrl, apiKey, model, messages, temperature = 0.3, timeoutMs = 60_000 }: Request): Promise<Completion> {
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature, max_tokens: 8192 }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new AiHttpError(res.status, (await res.text().catch(() => "")).slice(0, 500));
  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  // Some gateways return the content as a list of parts
  const text = Array.isArray(content) ? content.map((p: { text?: string }) => p?.text ?? "").join("") : content;
  return {
    text: typeof text === "string" ? text : "",
    tokensIn: data?.usage?.prompt_tokens ?? null,
    tokensOut: data?.usage?.completion_tokens ?? null,
  };
}

// Current Claude models take no temperature and always think; low effort keeps short chat answers fast.
// A gateway that does not pass output_config through gets the request again without it
async function claudeCompletion({ baseUrl, apiKey, model, messages, timeoutMs = 60_000 }: Request): Promise<Completion> {
  const client = new Anthropic({
    // The SDK adds /v1 itself; gateways differ in which header carries the key, so both are sent
    baseURL: baseUrl.replace(/\/+$/, "").replace(/\/v1$/, ""),
    apiKey,
    authToken: apiKey,
    timeout: timeoutMs,
    maxRetries: 1,
  });
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const turns = messages.filter((m) => m.role !== "system") as Anthropic.MessageParam[];
  // The conversation must open with the client's turn
  while (turns[0]?.role === "assistant") turns.shift();
  const params: Anthropic.MessageCreateParamsNonStreaming = { model, max_tokens: 16_000, messages: turns, ...(system && { system }) };

  let response: Anthropic.Message;
  try {
    try {
      response = await client.messages.create({ ...params, output_config: { effort: "low" } });
    } catch (e) {
      if (!(e instanceof Anthropic.BadRequestError && /output_config|effort/i.test(e.message))) throw e;
      response = await client.messages.create(params);
    }
  } catch (e) {
    if (e instanceof Anthropic.APIError && e.status) throw new AiHttpError(e.status, e.message.slice(0, 500));
    throw e;
  }
  // A declined request has no answer: the caller treats it as one for a manager
  const text = response.stop_reason === "refusal" ? "" : response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return { text, tokensIn: response.usage.input_tokens, tokensOut: response.usage.output_tokens };
}
