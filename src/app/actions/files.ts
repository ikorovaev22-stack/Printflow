"use server";

import { after } from "next/server";
import { notifyFileUploaded } from "@/lib/notify";
import { MAX_FILE_SIZE } from "@/lib/files";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string; url?: string };

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims.sub };
}

// The browser uploads straight to storage (policies check the order), then registers the file here
export async function registerFile(input: { orderId: string; path: string; name: string; size: number; mime: string }): Promise<Result> {
  const { supabase, userId } = await session();
  if (!userId) return { error: "Сессия истекла, войдите снова" };
  const { data: order } = await supabase.from("orders").select("id, company_id").eq("id", input.orderId).maybeSingle();
  const cleanup = () => supabase.storage.from("order-files").remove([input.path]);
  if (!order || !input.path.startsWith(`${order.company_id}/${order.id}/`)) {
    await cleanup();
    return { error: "Заказ не найден" };
  }
  if (input.size < 1 || input.size > MAX_FILE_SIZE) {
    await cleanup();
    return { error: "Файл должен быть не больше 50 МБ" };
  }
  const { data: file, error } = await supabase
    .from("order_files")
    .insert({
      order_id: order.id,
      company_id: order.company_id,
      uploaded_by: userId,
      name: input.name.slice(0, 200) || "Файл",
      path: input.path,
      size: input.size,
      mime: input.mime.slice(0, 120) || null,
    })
    .select("id, from_client, name")
    .single();
  if (error) {
    await cleanup();
    return { error: "Не удалось сохранить файл" };
  }
  after(() => notifyFileUploaded(order.id, file.name, file.from_client));
  return {};
}

// Short-lived link that downloads under the original name (never rendered inline)
export async function fileUrl(fileId: string): Promise<Result> {
  const { supabase } = await session();
  const { data: file } = await supabase.from("order_files").select("path, name").eq("id", fileId).maybeSingle();
  if (!file) return { error: "Файл не найден" };
  const { data, error } = await supabase.storage.from("order-files").createSignedUrl(file.path, 120, { download: file.name });
  return error ? { error: "Не удалось получить ссылку" } : { url: data.signedUrl };
}

export async function deleteFile(fileId: string): Promise<Result> {
  const { supabase } = await session();
  const { data: file } = await supabase.from("order_files").select("path").eq("id", fileId).maybeSingle();
  if (!file) return { error: "Файл не найден" };
  const { data: deleted } = await supabase.from("order_files").delete().eq("id", fileId).select("id");
  if (!deleted?.length) return { error: "Удалить можно только свои файлы" };
  await supabase.storage.from("order-files").remove([file.path]);
  return {};
}
