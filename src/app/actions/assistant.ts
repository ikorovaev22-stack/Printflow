"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/app/actions/auth";
import { requireStaff } from "@/lib/auth";
import { AI_MODES, PROMPTS, type AiMode, type PromptKind, type ReplyDecision } from "@/lib/assistant";
import { AiError, readPage, suggestFaqs, testReply, writeContent } from "@/lib/assistant-server";
import { rateLimit } from "@/lib/rate-limit";
import { PageError } from "@/lib/safe-fetch";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const OWNER_ONLY = "Только владелец настраивает ИИ-помощника";

async function requireOwner() {
  const session = await requireStaff();
  return session.profile.role === "owner" ? session : null;
}

// Model calls cost money: a few per minute per print shop is plenty for people clicking buttons
const aiAllowed = (companyId: string) => rateLimit(`ai:${companyId}`, 20, 60_000);

const failure = (e: unknown, fallback: string) => {
  if (e instanceof AiError || e instanceof PageError) return e.message;
  console.error(fallback, e);
  return fallback;
};

const refresh = () => revalidatePath("/admin/ai", "layout");

export async function saveAiSettings(_: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner();
  if (!session) return { error: OWNER_ONLY };
  const mode = str(fd, "mode") as AiMode;
  if (!AI_MODES.some((m) => m.value === mode)) return { error: "Выберите режим" };
  const handoff = str(fd, "handoff_text").slice(0, 500) || null;
  const { error } = await session.supabase
    .from("ai_settings")
    .upsert({ company_id: session.company.id, mode, handoff_text: handoff, updated_at: new Date().toISOString() });
  if (error) return { error: "Не удалось сохранить" };
  refresh();
  return { message: "Сохранено" };
}

export async function savePrompt(_: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner();
  if (!session) return { error: OWNER_ONLY };
  const kind = str(fd, "kind") as PromptKind;
  const body = str(fd, "body");
  if (!(kind in PROMPTS)) return { error: "Неизвестный промпт" };
  if (!body) return { error: "Промпт не может быть пустым" };
  if (body.length > 8000) return { error: "Промпт длиннее 8000 символов" };
  const { error } = await session.supabase
    .from("ai_prompts")
    .upsert({ company_id: session.company.id, kind, body, updated_at: new Date().toISOString() });
  if (error) return { error: "Не удалось сохранить" };
  refresh();
  return { message: "Промпт сохранён" };
}

export async function resetPrompt(kind: PromptKind) {
  const session = await requireOwner();
  if (!session) throw new Error(OWNER_ONLY);
  await session.supabase.from("ai_prompts").delete().eq("company_id", session.company.id).eq("kind", kind);
  refresh();
}

export async function testAnswer(question: string): Promise<{ decision?: ReplyDecision; error?: string }> {
  const session = await requireOwner();
  if (!session) return { error: OWNER_ONLY };
  const q = question.trim().slice(0, 2000);
  if (!q) return { error: "Напишите вопрос клиента" };
  if (!aiAllowed(session.company.id)) return { error: "Слишком много запросов, подождите минуту" };
  try {
    return { decision: await testReply(session.supabase, session.company, q) };
  } catch (e) {
    return { error: failure(e, "Не удалось получить ответ") };
  }
}

export async function saveKnowledge(_: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner();
  if (!session) return { error: OWNER_ONLY };
  const id = str(fd, "id");
  const entry = { title: str(fd, "title").slice(0, 200), body: str(fd, "body").slice(0, 20_000) };
  if (!entry.title || !entry.body) return { error: "Заполните заголовок и текст" };
  const { supabase, company } = session;
  const res = id
    ? await supabase.from("ai_knowledge").update(entry).eq("id", id).select("id")
    : await supabase.from("ai_knowledge").insert({ ...entry, company_id: company.id }).select("id");
  if (res.error?.message.includes("ai_limit")) return { error: "В базе знаний не больше 50 записей" };
  if (res.error || !res.data?.length) return { error: "Не удалось сохранить" };
  refresh();
  return { message: "Сохранено" };
}

export async function addPage(_: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner();
  if (!session) return { error: OWNER_ONLY };
  if (!aiAllowed(session.company.id)) return { error: "Слишком много запросов, подождите минуту" };
  try {
    const page = await readPage(session.supabase, session.company.id, str(fd, "url"));
    const { error } = await session.supabase
      .from("ai_knowledge")
      .insert({ company_id: session.company.id, title: page.title, body: page.body, url: page.url, fetched_at: new Date().toISOString() });
    if (error) return { error: error.message.includes("ai_limit") ? "В базе знаний не больше 50 записей" : "Не удалось сохранить" };
  } catch (e) {
    return { error: failure(e, "Не удалось прочитать страницу") };
  }
  refresh();
  return { message: "Страница прочитана и добавлена в базу знаний" };
}

export async function refreshPage(id: string): Promise<{ error?: string }> {
  const session = await requireOwner();
  if (!session) return { error: OWNER_ONLY };
  const { data: entry } = await session.supabase.from("ai_knowledge").select("url").eq("id", id).maybeSingle();
  if (!entry?.url) return { error: "У записи нет адреса страницы" };
  if (!aiAllowed(session.company.id)) return { error: "Слишком много запросов, подождите минуту" };
  try {
    const page = await readPage(session.supabase, session.company.id, entry.url);
    const { error } = await session.supabase
      .from("ai_knowledge")
      .update({ body: page.body, url: page.url, fetched_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: "Не удалось сохранить" };
  } catch (e) {
    return { error: failure(e, "Не удалось прочитать страницу") };
  }
  refresh();
  return {};
}

export async function toggleKnowledge(id: string, enabled: boolean) {
  const session = await requireOwner();
  if (!session) throw new Error(OWNER_ONLY);
  const { data } = await session.supabase.from("ai_knowledge").update({ enabled }).eq("id", id).select("id");
  if (!data?.length) throw new Error("Не удалось сохранить");
  refresh();
}

export async function deleteKnowledge(id: string) {
  const session = await requireOwner();
  if (!session) throw new Error(OWNER_ONLY);
  const { data } = await session.supabase.from("ai_knowledge").delete().eq("id", id).select("id");
  if (!data?.length) throw new Error("Не удалось удалить");
  refresh();
}

export async function saveTemplate(_: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner();
  if (!session) return { error: OWNER_ONLY };
  const id = str(fd, "id");
  const t = { question: str(fd, "question").slice(0, 500), answer: str(fd, "answer").slice(0, 4000) };
  if (!t.question || !t.answer) return { error: "Заполните вопрос и ответ" };
  const { supabase, company } = session;
  let res;
  if (id) res = await supabase.from("ai_templates").update(t).eq("id", id).select("id");
  else {
    const { count } = await supabase.from("ai_templates").select("id", { count: "exact", head: true }).eq("company_id", company.id);
    res = await supabase.from("ai_templates").insert({ ...t, company_id: company.id, position: count ?? 0 }).select("id");
  }
  if (res.error?.message.includes("ai_limit")) return { error: "Не больше 100 шаблонов" };
  if (res.error || !res.data?.length) return { error: "Не удалось сохранить" };
  refresh();
  return { message: "Сохранено" };
}

export async function deleteTemplate(id: string) {
  const session = await requireOwner();
  if (!session) throw new Error(OWNER_ONLY);
  const { data } = await session.supabase.from("ai_templates").delete().eq("id", id).select("id");
  if (!data?.length) throw new Error("Не удалось удалить");
  refresh();
}

// A news or FAQ draft: written by the model from a topic, or typed by hand (first line is the title)
export async function createDraft(_: FormState, fd: FormData): Promise<FormState> {
  const session = await requireOwner();
  if (!session) return { error: OWNER_ONLY };
  const kind = str(fd, "kind") === "faq" ? "faq" : "post";
  const text = str(fd, "topic");
  if (!text) return { error: kind === "post" ? "Напишите, о чём новость" : "Напишите, о чём вопрос" };
  let draft: { title: string; body: string };
  if (fd.get("with") === "ai") {
    if (!aiAllowed(session.company.id)) return { error: "Слишком много запросов, подождите минуту" };
    try {
      draft = await writeContent(session.supabase, session.company, kind, text);
    } catch (e) {
      return { error: failure(e, "Не удалось написать черновик") };
    }
  } else {
    const [first, ...rest] = text.split("\n");
    draft = { title: first.trim().slice(0, kind === "post" ? 200 : 300), body: (rest.join("\n").trim() || first.trim()).slice(0, 5000) };
  }
  const { error } = await session.supabase.from("ai_drafts").insert({ company_id: session.company.id, kind, ...draft });
  if (error) return { error: "Не удалось сохранить черновик" };
  refresh();
  return { message: "Черновик готов — проверьте и опубликуйте" };
}

export async function suggestFaqDrafts(): Promise<{ count?: number; error?: string }> {
  const session = await requireOwner();
  if (!session) return { error: OWNER_ONLY };
  if (!aiAllowed(session.company.id)) return { error: "Слишком много запросов, подождите минуту" };
  try {
    const items = await suggestFaqs(session.supabase, session.company);
    if (items.length) {
      const { error } = await session.supabase
        .from("ai_drafts")
        .insert(items.map((i) => ({ company_id: session.company.id, kind: "faq", title: i.question, body: i.answer })));
      if (error) return { error: "Не удалось сохранить черновики" };
    }
    refresh();
    return { count: items.length };
  } catch (e) {
    return { error: failure(e, "Не удалось предложить вопросы") };
  }
}

// Checked by a person: a chat reply goes to the client (any staff), news and FAQ appear in the app (owner)
export async function publishDraft(id: string, title: string, body: string): Promise<{ error?: string }> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("publish_ai_draft", { p_draft_id: id, p_title: title, p_body: body });
  if (error) {
    if (error.message.includes("draft_decided")) return { error: "Черновик уже отправлен или отклонён" };
    if (error.message.includes("draft_empty")) return { error: "Заполните текст" };
    if (error.message.includes("rate_limited")) return { error: "Слишком много сообщений, подождите минуту" };
    if (error.code === "42501") return { error: "Нет прав на публикацию" };
    return { error: "Не удалось опубликовать" };
  }
  revalidatePath("/", "layout");
  return {};
}

export async function dismissDraft(id: string): Promise<{ error?: string }> {
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("ai_drafts").update({ status: "dismissed" }).eq("id", id).eq("status", "pending").select("id");
  if (!data?.length) return { error: "Черновик уже отправлен или отклонён" };
  revalidatePath("/admin", "layout");
  return {};
}

export async function deletePost(id: string) {
  const session = await requireOwner();
  if (!session) throw new Error(OWNER_ONLY);
  const { data } = await session.supabase.from("posts").delete().eq("id", id).select("id");
  if (!data?.length) throw new Error("Не удалось удалить");
  revalidatePath("/", "layout");
}
