"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import type { FormState } from "@/app/actions/auth";
import { isTimeZone } from "@/lib/format";
import { logoSrc } from "@/lib/brand";

const opt = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim() || null;

export async function saveFaq(_: FormState, fd: FormData): Promise<FormState> {
  const { supabase, company } = await requireStaff();
  const id = opt(fd, "id");
  const faq = { question: opt(fd, "question"), answer: opt(fd, "answer") };
  if (!faq.question || !faq.answer) return { error: "Заполните вопрос и ответ" };

  let error;
  if (id) {
    const res = await supabase.from("faqs").update(faq).eq("id", id).select("id");
    error = res.error ?? (res.data?.length ? null : new Error("not found"));
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
  const { data } = await supabase.from("faqs").delete().eq("id", id).select("id");
  if (!data?.length) throw new Error("Не удалось удалить вопрос");
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
  const name = opt(fd, "name");
  if (!name) return { error: "Укажите название" };
  const timezone = opt(fd, "timezone") ?? company.timezone;
  if (!isTimeZone(timezone)) return { error: "Неизвестный часовой пояс" };
  const logoUrl = opt(fd, "logo_url");
  if (logoUrl && !logoSrc({ id: company.id, logo_url: logoUrl })) return { error: "Недопустимый адрес логотипа" };
  // "@name", "t.me/name" and "https://t.me/name" all become "name"
  const telegram = opt(fd, "telegram")?.replace(/^(https?:\/\/)?(t\.me|telegram\.me)\//i, "").replace(/^@/, "") || null;
  if (telegram && !/^[A-Za-z0-9_]{5,32}$/.test(telegram)) return { error: "Telegram: имя из латиницы, цифр и _, от 5 до 32 символов" };
  // "max.ru/u/…" and "http(s)://max.ru/u/…" become "https://max.ru/u/…"
  const maxUrl = opt(fd, "max_url")?.replace(/^(https?:\/\/)?(www\.)?max\.ru\//i, "https://max.ru/") ?? null;
  if (maxUrl && (maxUrl.length > 300 || !/^https:\/\/max\.ru\/[A-Za-z0-9_@./?=&%-]+$/.test(maxUrl))) {
    return { error: "MAX: вставьте ссылку на профиль вида https://max.ru/u/…" };
  }

  const { error } = await supabase
    .from("companies")
    .update({
      name,
      logo_url: logoUrl,
      phone: opt(fd, "phone"),
      email: opt(fd, "email"),
      address: opt(fd, "address"),
      work_hours: opt(fd, "work_hours"),
      telegram,
      max_url: maxUrl,
      max_phone: opt(fd, "max_phone"),
      finishing_stage: fd.get("finishing_stage") === "on",
      timezone,
    })
    .eq("id", company.id);
  if (error) return { error: "Не удалось сохранить" };

  // Drop replaced/removed logo files
  const { data: files } = await supabase.storage.from("logos").list(company.id);
  const stale = (files ?? []).filter((f) => !logoUrl?.endsWith(`/${f.name}`)).map((f) => `${company.id}/${f.name}`);
  if (stale.length) await supabase.storage.from("logos").remove(stale);

  revalidatePath("/", "layout");
  return { message: "Настройки сохранены" };
}

// Banners: the owner uploads the image straight to storage ("banners/<company_id>/..."), then registers it here
async function requireOwner() {
  const session = await requireStaff();
  if (session.profile.role !== "owner") throw new Error("Баннеры меняет только владелец");
  return session;
}

export async function addBanner(path: string): Promise<{ error?: string }> {
  const { supabase, company, profile } = await requireStaff();
  if (profile.role !== "owner") return { error: "Баннеры меняет только владелец" };
  const file = path.startsWith(`${company.id}/`) ? path.slice(company.id.length + 1) : "";
  if (!/^[\w.-]{1,100}$/.test(file)) return { error: "Недопустимый файл" };
  const { data: last } = await supabase
    .from("banners")
    .select("position")
    .eq("company_id", company.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("banners").insert({ company_id: company.id, path, position: (last?.position ?? -1) + 1 });
  if (error) {
    await supabase.storage.from("banners").remove([path]);
    return { error: error.message.includes("banner_limit") ? "Не больше 10 баннеров" : "Не удалось добавить баннер" };
  }
  revalidatePath("/", "layout");
  return {};
}

export async function saveBannerTitle(id: string, title: string) {
  const { supabase } = await requireOwner();
  const { data } = await supabase
    .from("banners")
    .update({ title: title.trim().slice(0, 120) || null })
    .eq("id", id)
    .select("id");
  if (!data?.length) throw new Error("Не удалось сохранить подпись");
  revalidatePath("/", "layout");
}

export async function deleteBanner(id: string) {
  const { supabase } = await requireOwner();
  const { data } = await supabase.from("banners").delete().eq("id", id).select("path");
  if (!data?.length) throw new Error("Не удалось удалить баннер");
  await supabase.storage.from("banners").remove([data[0].path]);
  revalidatePath("/", "layout");
}

export async function moveBanner(id: string, dir: -1 | 1) {
  const { supabase, company } = await requireOwner();
  const { data } = await supabase.from("banners").select("id, position").eq("company_id", company.id).order("position");
  const list = data ?? [];
  const i = list.findIndex((b) => b.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((b, position) => supabase.from("banners").update({ position }).eq("id", b.id)));
  revalidatePath("/", "layout");
}
