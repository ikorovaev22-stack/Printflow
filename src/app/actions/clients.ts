"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Owner only: removes the account together with every order, file and message (also a 152-ФЗ deletion request).
// Rows go with the account by cascade; storage objects do not, so their paths are collected first.
export async function deleteClient(id: string): Promise<{ error?: string }> {
  const { supabase, profile } = await requireStaff();
  if (profile.role !== "owner") return { error: "Удалять клиентов может только владелец" };
  const { data: client } = await supabase.from("profiles").select("id").eq("id", id).eq("role", "client").maybeSingle();
  if (!client) return { error: "Клиент не найден" };
  const admin = createAdminClient();
  if (!admin) return { error: "На сервере не задан SUPABASE_SERVICE_ROLE_KEY" };

  const { data: orders } = await supabase.from("orders").select("id").eq("client_id", id);
  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: files } = orderIds.length ? await supabase.from("order_files").select("path").in("order_id", orderIds) : { data: [] };

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: "Не удалось удалить клиента" };
  const paths = (files ?? []).map((f) => f.path);
  for (let i = 0; i < paths.length; i += 100) await admin.storage.from("order-files").remove(paths.slice(i, i + 100));

  revalidatePath("/admin", "layout");
  redirect("/admin/clients");
}
