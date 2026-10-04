"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import type { FormState } from "@/app/actions/auth";
import type { OrderStatus } from "@/lib/types";

const opt = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim() || null;

export async function saveOrder(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, company } = await requireStaff();
  const id = opt(fd, "id");
  const order = {
    client_id: opt(fd, "client_id"),
    title: opt(fd, "title"),
    description: opt(fd, "description"),
    status: opt(fd, "status") ?? "accepted",
    due_date: opt(fd, "due_date"),
    delivery_method: opt(fd, "delivery_method") ?? "pickup",
    delivery_address: opt(fd, "delivery_address"),
    comment: opt(fd, "comment"),
  };
  if (!order.client_id || !order.title) return { error: "Укажите клиента и название заказа" };

  const { data, error } = id
    ? await supabase.from("orders").update(order).eq("id", id).select("id")
    : await supabase.from("orders").insert({ ...order, company_id: company.id }).select("id");
  if (error || !data?.length) return { error: "Не удалось сохранить заказ" };

  revalidatePath("/admin", "layout");
  const back = String(fd.get("back") ?? "");
  redirect(/^\/admin\/[\w/-]*$/.test(back) ? back : "/admin/orders");
}

export async function updateOrder(id: string, patch: { status?: OrderStatus; due_date?: string | null }) {
  const { supabase } = await requireStaff();
  const allowed = { ...("status" in patch && { status: patch.status }), ...("due_date" in patch && { due_date: patch.due_date }) };
  const { data, error } = await supabase.from("orders").update(allowed).eq("id", id).select("id");
  if (error || !data?.length) throw new Error("Не удалось обновить заказ");
  revalidatePath("/admin", "layout");
}

export async function deleteOrder(id: string) {
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("orders").delete().eq("id", id).select("id");
  if (!data?.length) throw new Error("Не удалось удалить заказ");
  revalidatePath("/admin", "layout");
  redirect("/admin/orders");
}
