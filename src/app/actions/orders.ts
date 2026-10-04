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

  const { error } = id
    ? await supabase.from("orders").update(order).eq("id", id)
    : await supabase.from("orders").insert({ ...order, company_id: company.id });
  if (error) return { error: "Не удалось сохранить заказ" };

  revalidatePath("/admin", "layout");
  redirect(String(fd.get("back") || "/admin/orders"));
}

export async function updateOrder(id: string, patch: { status?: OrderStatus; due_date?: string | null }) {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) throw new Error("Не удалось обновить заказ");
  revalidatePath("/admin", "layout");
}

export async function deleteOrder(id: string) {
  const { supabase } = await requireStaff();
  await supabase.from("orders").delete().eq("id", id);
  revalidatePath("/admin", "layout");
  redirect("/admin/orders");
}
