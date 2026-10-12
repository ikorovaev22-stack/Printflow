"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { notifyOrder } from "@/lib/notify";
import { requireStaff } from "@/lib/auth";
import type { FormState } from "@/app/actions/auth";
import type { OrderStatus } from "@/lib/types";

const opt = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim() || null;

export async function saveOrder(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, company } = await requireStaff();
  const id = opt(fd, "id");
  const price = opt(fd, "price");
  const order = {
    client_id: opt(fd, "client_id"),
    title: opt(fd, "title"),
    description: opt(fd, "description"),
    status: opt(fd, "status") ?? "accepted",
    due_date: opt(fd, "due_date"),
    delivery_method: opt(fd, "delivery_method") ?? "pickup",
    delivery_address: opt(fd, "delivery_address"),
    comment: opt(fd, "comment"),
    price: price === null ? null : Number(price),
  };
  if (!order.client_id || !order.title) return { error: "Укажите клиента и название заказа" };
  if (order.price !== null && (!Number.isInteger(order.price) || order.price < 0 || order.price > 100_000_000)) {
    return { error: "Стоимость — целое число рублей" };
  }
  if (order.title.length > 200) return { error: "Название не длиннее 200 символов" };

  const before = id ? (await supabase.from("orders").select("status").eq("id", id).maybeSingle()).data : null;
  const { data, error } = id
    ? await supabase.from("orders").update(order).eq("id", id).select("id")
    : await supabase.from("orders").insert({ ...order, company_id: company.id }).select("id");
  if (error || !data?.length) return { error: "Не удалось сохранить заказ" };

  const saved = data[0].id;
  if (!id) after(() => notifyOrder(saved, "created"));
  else if (before && before.status !== order.status) after(() => notifyOrder(saved, "status"));
  revalidatePath("/admin", "layout");
  const back = String(fd.get("back") ?? "");
  redirect(/^\/admin\/[\w/-]*$/.test(back) ? back : "/admin/orders");
}

export async function updateOrder(id: string, patch: { status?: OrderStatus; due_date?: string | null }) {
  const { supabase } = await requireStaff();
  const allowed = { ...("status" in patch && { status: patch.status }), ...("due_date" in patch && { due_date: patch.due_date }) };
  const before = "status" in patch ? (await supabase.from("orders").select("status").eq("id", id).maybeSingle()).data : null;
  const { data, error } = await supabase.from("orders").update(allowed).eq("id", id).select("id");
  if (error || !data?.length) throw new Error("Не удалось обновить заказ");
  if (before && before.status !== patch.status) after(() => notifyOrder(id, "status"));
  revalidatePath("/admin", "layout");
}

export async function deleteOrder(id: string) {
  const { supabase } = await requireStaff();
  // File rows cascade with the order, storage objects do not; storage policies need the order to exist, so remove them first
  const { data: files } = await supabase.from("order_files").select("path").eq("order_id", id);
  if (files?.length) await supabase.storage.from("order-files").remove(files.map((f) => f.path));
  const { data } = await supabase.from("orders").delete().eq("id", id).select("id");
  if (!data?.length) throw new Error("Не удалось удалить заказ");
  revalidatePath("/admin", "layout");
  redirect("/admin/orders");
}
