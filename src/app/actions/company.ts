"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import type { FormState } from "@/app/actions/auth";

const opt = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim() || null;

export async function saveFaq(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, company } = await requireStaff();
  const id = opt(fd, "id");
  const faq = { question: opt(fd, "question"), answer: opt(fd, "answer") };
  if (!faq.question || !faq.answer) return { error: "Заполните вопрос и ответ" };

  let error;
  if (id) {
    ({ error } = await supabase.from("faqs").update(faq).eq("id", id));
  } else {
    const { count } = await supabase
      .from("faqs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id);
    ({ error } = await supabase.from("faqs").insert({ ...faq, company_id: company.id, position: count ?? 0 }));
  }
  if (error) return { error: "Не удалось сохранить" };
  revalidatePath("/", "layout");
  return { message: "ok" };
}

export async function deleteFaq(id: string) {
  const { supabase } = await requireStaff();
  await supabase.from("faqs").delete().eq("id", id);
  revalidatePath("/", "layout");
}

export async function moveFaq(id: string, dir: -1 | 1) {
  const { supabase, company } = await requireStaff();
  const { data } = await supabase.from("faqs").select("id, position").eq("company_id", company.id).order("position");
  const list = data ?? [];
  const i = list.findIndex((f) => f.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((f, position) => supabase.from("faqs").update({ position }).eq("id", f.id)));
  revalidatePath("/", "layout");
}

export async function saveCompany(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, company, profile } = await requireStaff();
  if (profile.role !== "owner") return { error: "Только владелец может менять настройки" };
  const color = opt(fd, "brand_color") ?? "";
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { error: "Цвет должен быть в формате #RRGGBB" };
  const name = opt(fd, "name");
  if (!name) return { error: "Укажите название" };

  const { error } = await supabase
    .from("companies")
    .update({
      name,
      brand_color: color,
      logo_url: opt(fd, "logo_url"),
      phone: opt(fd, "phone"),
      email: opt(fd, "email"),
      address: opt(fd, "address"),
      work_hours: opt(fd, "work_hours"),
    })
    .eq("id", company.id);
  if (error) return { error: "Не удалось сохранить" };
  revalidatePath("/", "layout");
  return { message: "Настройки сохранены" };
}
