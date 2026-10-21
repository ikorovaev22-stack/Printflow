import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AiHttpError, chatCompletion } from "@/lib/ai-client";
import { SITE_URL } from "@/lib/config";
import { formatDateShort } from "@/lib/format";
import { notifyMessage } from "@/lib/notify";
import { parsePriceList, productList } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPublicPage } from "@/lib/safe-fetch";
import {
  DEFAULT_HANDOFF_TEXT,
  PROMPTS,
  clip,
  contentMessages,
  faqSuggestMessages,
  htmlToText,
  knowledgeMessages,
  knowledgeText,
  parseContent,
  parseFaqItems,
  parseReply,
  replyMessages,
  type AiMode,
  type Knowledge,
  type ModelMessage,
  type PromptKind,
  type ReplyDecision,
} from "@/lib/assistant";
import { statusMeta, type Company, type Message, type OrderStatus } from "@/lib/types";

// Any OpenAI-compatible API: a Russian gateway to Gemini, Vercel AI Gateway, OpenRouter… (see .env.example)
const AI_BASE_URL = process.env.AI_BASE_URL;
const AI_API_KEY = process.env.AI_API_KEY;
const AI_MODEL = process.env.AI_MODEL;
export const aiConfigured = () => Boolean(AI_BASE_URL && AI_API_KEY && AI_MODEL);

export class AiError extends Error {}

export async function complete(messages: ModelMessage[], temperature = 0.3): Promise<string> {
  if (!aiConfigured()) throw new AiError("ИИ не подключён");
  let text: string;
  try {
    ({ text } = await chatCompletion({ baseUrl: AI_BASE_URL!, apiKey: AI_API_KEY!, model: AI_MODEL!, messages, temperature }));
  } catch (e) {
    console.error("ai request failed", e);
    if (e instanceof AiHttpError) {
      throw new AiError(e.status === 401 || e.status === 403 ? "Нейросеть отклонила ключ API" : `Нейросеть вернула ошибку ${e.status}`);
    }
    throw new AiError("Нейросеть не ответила, попробуйте ещё раз");
  }
  if (!text.trim()) throw new AiError("Нейросеть вернула пустой ответ");
  return text;
}

export async function getPrompts(db: SupabaseClient, companyId: string): Promise<Record<PromptKind, string>> {
  const { data } = await db.from("ai_prompts").select("kind, body").eq("company_id", companyId);
  const saved = new Map((data ?? []).map((p) => [p.kind as PromptKind, p.body as string]));
  return { reply: saved.get("reply") ?? PROMPTS.reply.text, knowledge: saved.get("knowledge") ?? PROMPTS.knowledge.text, content: saved.get("content") ?? PROMPTS.content.text };
}

export async function loadKnowledge(db: SupabaseClient, company: Company): Promise<Knowledge> {
  const [{ data: entries }, { data: templates }, { data: faqs }, { data: posts }, { data: prices }] = await Promise.all([
    db.from("ai_knowledge").select("title, body").eq("company_id", company.id).eq("enabled", true).order("created_at"),
    db.from("ai_templates").select("question, answer").eq("company_id", company.id).order("position"),
    db.from("faqs").select("question, answer").eq("company_id", company.id).order("position"),
    db.from("posts").select("title, body").eq("company_id", company.id).order("created_at", { ascending: false }).limit(5),
    db.from("price_lists").select("config").eq("company_id", company.id).maybeSingle(),
  ]);
  const parsed = prices ? parsePriceList(prices.config) : null;
  const products = parsed?.ok ? productList(parsed.value).map((p) => p.label) : [];
  return {
    company,
    calculator: products.length ? { url: SITE_URL ? `${SITE_URL}/c/${company.slug}/calculator` : "раздел «Расчёт стоимости»", products } : null,
    entries: entries ?? [],
    templates: templates ?? [],
    faqs: faqs ?? [],
    posts: posts ?? [],
  };
}

// The model's decision for one conversation: the client's last message is at the end of history
async function decideReply(db: SupabaseClient, company: Company, history: { fromClient: boolean; body: string }[], clientId: string | null) {
  const [prompts, knowledge, orders] = await Promise.all([
    getPrompts(db, company.id),
    loadKnowledge(db, company),
    clientId
      ? db
          .from("orders")
          .select("number, title, status, due_date")
          .eq("client_id", clientId)
          .neq("status", "delivered")
          .order("created_at", { ascending: false })
          .limit(10)
          .then(({ data }) => data ?? [])
      : null,
  ]);
  const text = await complete(
    replyMessages({
      prompt: prompts.reply,
      knowledge: knowledgeText(knowledge),
      orders: orders?.map((o) => ({
        number: o.number,
        title: o.title,
        status: statusMeta(o.status as OrderStatus).label,
        due: o.due_date ? formatDateShort(o.due_date, company.timezone) : null,
      })) ?? null,
      history,
    }),
  );
  const decision = parseReply(text);
  if (!decision) {
    console.error("ai reply: unreadable answer", clip(text, 300));
    throw new AiError("Нейросеть ответила не в том формате, попробуйте ещё раз");
  }
  return decision;
}

// "Проверка ответа" in the panel: what the autoresponder would say, nothing is sent
export async function testReply(db: SupabaseClient, company: Company, question: string): Promise<ReplyDecision> {
  return decideReply(db, company, [{ fromClient: true, body: question }], null);
}

// A burst of messages gets one answer, to the last of them
const REPLY_DELAY_MS = Number(process.env.AI_REPLY_DELAY_MS ?? 6000);
// In auto mode the assistant keeps quiet while a manager is in the conversation
const MANAGER_PAUSE_MS = 2 * 60 * 60 * 1000;
const MAX_REPLIES_PER_HOUR = 10;

// After a client's chat message (next/server `after`): a draft for a manager, or in auto mode an answer or a handoff.
// Runs with the service role: the client who triggered it cannot write drafts or the assistant's messages
export async function answerClientMessage(m: Message) {
  const db = createAdminClient();
  if (!db || !aiConfigured() || !m.from_client) return;
  const { data: settings } = await db.from("ai_settings").select("mode, handoff_text").eq("company_id", m.company_id).maybeSingle<{ mode: AiMode; handoff_text: string | null }>();
  if (!settings || settings.mode === "off") return;

  await new Promise((r) => setTimeout(r, REPLY_DELAY_MS));
  const latest = async () =>
    (await db.from("messages").select("id").eq("client_id", m.client_id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.id;
  if ((await latest()) !== m.id) return;

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ data: recent }, { data: drafts }, { data: company }] = await Promise.all([
    db.from("messages").select("body, from_client, ai, created_at").eq("client_id", m.client_id).order("created_at", { ascending: false }).limit(20),
    db.from("ai_drafts").select("status, handoff, created_at").eq("client_id", m.client_id).eq("kind", "reply").or(`status.eq.pending,created_at.gte."${hourAgo}"`),
    db.from("companies").select("*").eq("id", m.company_id).single<Company>(),
  ]);
  if (!company) return;
  // Waiting for a manager after a handoff, or too many answers in this chat within the hour
  if ((drafts ?? []).some((d) => d.status === "pending" && d.handoff)) return;
  if ((drafts ?? []).filter((d) => Date.parse(d.created_at) >= Date.parse(hourAgo)).length >= MAX_REPLIES_PER_HOUR) return;
  const history = (recent ?? []).reverse();
  const managerActive = history.some((x) => !x.from_client && !x.ai && Date.parse(x.created_at) > Date.now() - MANAGER_PAUSE_MS);
  if (settings.mode === "auto" && managerActive) return;

  let decision: ReplyDecision;
  try {
    decision = await decideReply(db, company, history.map((x) => ({ fromClient: x.from_client, body: x.body })), m.client_id);
  } catch (e) {
    console.error("ai reply failed", e);
    return;
  }
  // The client wrote again or a manager answered while the model was thinking
  if ((await latest()) !== m.id) return;

  const answer = decision.action === "answer" ? decision.answer : null;
  const handoff = answer === null;
  const draft = {
    company_id: m.company_id,
    kind: "reply",
    client_id: m.client_id,
    message_id: m.id,
    body: answer,
    handoff,
    note: decision.action === "handoff" ? decision.reason : null,
  };
  if (settings.mode === "draft") {
    // Only the newest draft in a chat stays
    await db.from("ai_drafts").update({ status: "dismissed" }).eq("client_id", m.client_id).eq("kind", "reply").eq("status", "pending");
    const { error } = await db.from("ai_drafts").insert(draft);
    if (error) console.error("ai draft failed", error);
    return;
  }

  const body = answer ?? (settings.handoff_text || DEFAULT_HANDOFF_TEXT);
  const { data: sent, error } = await db
    .from("messages")
    .insert({ company_id: m.company_id, client_id: m.client_id, sender_id: null, ai: true, body })
    .select()
    .single<Message>();
  if (error) return console.error("ai message failed", error);
  // A handoff stays open in the staff chat until a manager answers; an answer is kept as a record
  await db.from("ai_drafts").insert({ ...draft, status: handoff ? "pending" : "published" });
  await notifyMessage(sent);
}

export async function writeContent(db: SupabaseClient, company: Company, kind: "post" | "faq", topic: string) {
  const [prompts, knowledge] = await Promise.all([getPrompts(db, company.id), loadKnowledge(db, company)]);
  const result = parseContent(await complete(contentMessages({ prompt: prompts.content, knowledge: knowledgeText(knowledge), kind, topic }), 0.6), kind);
  if (!result) throw new AiError("Нейросеть ответила не в том формате, попробуйте ещё раз");
  return result;
}

// Questions clients ask in the chat that "Вопросы и ответы" does not cover yet
export async function suggestFaqs(db: SupabaseClient, company: Company) {
  const [prompts, knowledge, { data: messages }, { data: faqs }] = await Promise.all([
    getPrompts(db, company.id),
    loadKnowledge(db, company),
    db.from("messages").select("body").eq("company_id", company.id).eq("from_client", true).order("created_at", { ascending: false }).limit(200),
    db.from("faqs").select("question").eq("company_id", company.id),
  ]);
  const questions = [...new Set((messages ?? []).map((m) => m.body.trim()).filter((b) => b.length >= 10))].slice(0, 150);
  if (!questions.length) throw new AiError("В чате пока нет вопросов клиентов");
  const text = await complete(
    faqSuggestMessages({ prompt: prompts.content, knowledge: knowledgeText(knowledge, 20_000), questions, existing: (faqs ?? []).map((f) => f.question) }),
    0.4,
  );
  return parseFaqItems(text);
}

// A public page of the print shop's site as a knowledge base entry; without a model the page text is kept as is
export async function readPage(db: SupabaseClient, companyId: string, raw: string) {
  const page = await fetchPublicPage(raw);
  const { title, text } = htmlToText(page.html);
  if (text.length < 80) throw new AiError("На странице почти нет текста — возможно, сайт показывает его только скриптами");
  let body = clip(text, 20_000);
  if (aiConfigured()) {
    const prompts = await getPrompts(db, companyId);
    body = clip((await complete(knowledgeMessages({ prompt: prompts.knowledge, url: page.url, title, text }), 0.2)).trim(), 20_000);
  }
  return { url: page.url, title: title || new URL(page.url).hostname, body };
}
