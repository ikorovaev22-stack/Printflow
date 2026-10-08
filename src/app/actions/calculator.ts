"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getCompanyBySlug, getSession, requireStaff } from "@/lib/auth";
import { notifyOrderRequest } from "@/lib/notify";
import { getPriceList } from "@/lib/price-list";
import { normalizeInput, parsePriceList, quote } from "@/lib/pricing";
import { clientIp, limitIp, rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "@/app/actions/auth";
import type { OrderCalc } from "@/lib/types";

export type RequestState = { error?: string; login?: boolean } | undefined;

// Client request from the calculator. Only the options and a comment come from the browser: the price is
// recalculated here from the company's price list, and the client is taken from the session.
export async function requestOrder(slug: string, payload: { input: unknown; comment?: unknown }): Promise<RequestState> {
  const company = await getCompanyBySlug(slug);
  if (!company) return { error: "Типография не найдена" };
  const session = await getSession();
  if (!session || session.company.id !== company.id || session.profile.role !== "client") {
    return { error: "Войдите, чтобы оформить заказ", login: true };
  }
  const ip = await clientIp();
  if (!limitIp(ip, "order-request", 10, 10 * 60_000) || !rateLimit(`order-request:${session.profile.id}`, 5, 10 * 60_000)) {
    return { error: "Слишком много заявок подряд. Подождите несколько минут или напишите менеджеру в чат" };
  }

  const list = await getPriceList(company.id);
  if (!list) return { error: "Калькулятор сейчас недоступен" };
  const input = normalizeInput(payload.input, list.prices);
  if (!input) return { error: "Проверьте параметры заказа" };
  const comment = typeof payload.comment === "string" ? payload.comment.trim() : "";
  if (comment.length > 2000) return { error: "Комментарий не длиннее 2000 символов" };

  const q = quote(input, list.prices);
  const calc: OrderCalc = { input, lines: q.lines, total: q.total, price_list_updated_at: list.updatedAt };
  const admin = createAdminClient();
  if (!admin) return { error: "Не удалось оформить заказ, напишите менеджеру в чат" };
  const { data, error } = await admin
    .from("orders")
    .insert({
      company_id: company.id,
      client_id: session.profile.id,
      title: q.title,
      description: comment || null,
      source: "calculator",
      calc,
      price: q.total,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Не удалось оформить заказ, попробуйте ещё раз" };

  after(() => notifyOrderRequest(data.id));
  revalidatePath(`/c/${slug}`, "layout");
  revalidatePath("/admin", "layout");
  redirect(`/c/${slug}/orders/${data.id}`);
}

// Owner saves the price list; the same validation runs on every read
export async function savePriceList(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, profile, company } = await requireStaff();
  if (profile.role !== "owner") return { error: "Цены меняет только владелец" };
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("config") ?? ""));
  } catch {
    return { error: "Не удалось прочитать цены" };
  }
  const parsed = parsePriceList(raw);
  if (!parsed.ok) return { error: parsed.error };

  const updated = await supabase.from("price_lists").update({ config: parsed.value }).eq("company_id", company.id).select("company_id");
  const { error } = updated.data?.length
    ? updated
    : await supabase.from("price_lists").insert({ company_id: company.id, config: parsed.value });
  if (error) return { error: "Не удалось сохранить цены" };
  revalidatePath("/", "layout");
  return { message: "Цены сохранены" };
}
