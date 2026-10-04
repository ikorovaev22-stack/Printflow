"use server";

import { after } from "next/server";
import { getSession } from "@/lib/auth";
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
  return { message: data };
}
