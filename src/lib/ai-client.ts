// One call to an OpenAI-compatible chat API (clodex, Vercel AI Gateway, OpenRouter…). Node-only, no "server-only"
// marker so scripts/ai-compare.ts can use it; the app calls it through assistant-server.ts
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

export async function chatCompletion({
  baseUrl,
  apiKey,
  model,
  messages,
  temperature = 0.3,
  timeoutMs = 60_000,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ModelMessage[];
  temperature?: number;
  timeoutMs?: number;
}): Promise<Completion> {
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
