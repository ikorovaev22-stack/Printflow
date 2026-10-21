"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { answerClientMessage } from "@/lib/assistant-server";
import { getSession, requireStaff } from "@/lib/auth";
import { notifyMessage } from "@/lib/notify";
import type { Message } from "@/lib/types";

// Sent through the server so the other side gets a notification; RLS still decides who may write where
export async function sendMessage(clientId: string, body: string): Promise<{ message?: Message; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Сессия истекла, войдите снова" };
  const text = body.trim();
  if (!text) return { error: "Пустое сообщение" };
  if (text.length > 4000) return { error: "Сообщение длиннее 4000 символов" };

  const { supabase, profile } = session;
  const { data, error } = await supabase
    .from("messages")
    .insert({ company_id: profile.company_id, client_id: clientId, sender_id: profile.id, body: text })
    .select()
    .single<Message>();
  if (error) {
    return { error: error.message.includes("rate_limited") ? "Слишком много сообщений, подождите минуту" : "Не удалось отправить" };
  }
  after(() => notifyMessage(data));
  // The AI assistant answers or drafts an answer when it is switched on
  if (data.from_client) after(() => answerClientMessage(data));
  return { message: data };
}

// Staff only (RLS): any message of their company. Clients cannot delete — the flood limit counts stored messages
export async function deleteMessage(id: string): Promise<{ error?: string }> {
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("messages").delete().eq("id", id).select("id");
  if (!data?.length) return { error: "Не удалось удалить сообщение" };
  revalidatePath("/admin", "layout");
  return {};
}

export async function clearChat(clientId: string): Promise<{ error?: string }> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("messages").delete().eq("client_id", clientId);
  if (error) return { error: "Не удалось очистить переписку" };
  // The AI assistant's draft answered a message that is gone now
  await supabase.from("ai_drafts").update({ status: "dismissed" }).eq("client_id", clientId).eq("kind", "reply").eq("status", "pending");
  revalidatePath("/admin", "layout");
  return {};
}

// "Завершённые" folder; a new message from either side brings the chat back to the active ones
export async function closeChat(clientId: string): Promise<{ error?: string }> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("close_chat", { p_client_id: clientId });
  if (error) return { error: "Не удалось завершить чат" };
  revalidatePath("/admin/chat", "layout");
  return {};
}

export async function reopenChat(clientId: string): Promise<{ error?: string }> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.rpc("reopen_chat", { p_client_id: clientId });
  if (error) return { error: "Не удалось вернуть чат в активные" };
  revalidatePath("/admin/chat", "layout");
  return {};
}

export type MessageHit = { id: string; clientId: string; body: string; fromClient: boolean; at: string };

// Chat search by message text; names are matched in the browser
export async function searchMessages(query: string): Promise<MessageHit[]> {
  const { supabase } = await requireStaff();
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  const { data } = await supabase
    .from("messages")
    .select("id, client_id, body, from_client, created_at")
    .ilike("body", `%${q.replace(/[\\%_]/g, "\\$&")}%`)
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<Message[]>();
  return (data ?? []).map((m) => ({ id: m.id, clientId: m.client_id, body: m.body, fromClient: m.from_client, at: m.created_at }));
}
