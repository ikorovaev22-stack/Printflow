"use server";

import { redirect } from "next/navigation";
import { SITE_URL } from "@/lib/config";
import { clientIp, limitIp, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";

export type FormState = { error?: string; message?: string } | undefined;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

const TOO_MANY = { error: "Слишком много попыток. Подождите несколько минут и попробуйте снова" };

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const slug = str(fd, "slug");
  const email = str(fd, "email").toLowerCase();
  const ip = await clientIp();
  if (!limitIp(ip, "login", 10, 5 * 60_000) || !rateLimit(`login:${email}`, 20, 15 * 60_000)) return TOO_MANY;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: String(fd.get("password") ?? "") });
  if (error) return { error: "Неверный email или пароль" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company:companies(slug)")
    .eq("id", data.user.id)
    .single<{ role: string; company: { slug: string } }>();
  const isStaff = profile && profile.role !== "client";

  if (!slug) {
    if (!isStaff) {
      await supabase.auth.signOut();
      return { error: "У этого аккаунта нет доступа к панели управления" };
    }
    redirect("/admin/orders");
  }
  if (profile?.company.slug !== slug) {
    await supabase.auth.signOut();
    return { error: "Аккаунт не найден в этой компании" };
  }
  redirect(isStaff ? "/admin/orders" : (safeNext(slug, fd.get("next")) ?? `/c/${slug}`));
}

export async function signUp(_: FormState, fd: FormData): Promise<FormState> {
  const slug = str(fd, "slug");
  const password = String(fd.get("password") ?? "");
  const fullName = str(fd, "full_name");
  const phone = str(fd, "phone");
  if (password.length < 8) return { error: "Пароль должен быть не короче 8 символов" };
  if (password.length > 72) return { error: "Пароль слишком длинный" };
  if (!fullName || fullName.length > 120 || phone.length > 40) return { error: "Проверьте имя и телефон" };
  if (fd.get("pd_consent") !== "on") return { error: "Нужно согласие на обработку персональных данных" };
  if (!limitIp(await clientIp(), "signup", 5, 60 * 60_000)) return TOO_MANY;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: str(fd, "email"),
    password,
    options: {
      // pd_consent: the database stamps profiles.pd_consent_at (152-ФЗ)
      data: { company_slug: slug, full_name: fullName, phone, pd_consent: true },
      emailRedirectTo: SITE_URL ? `${SITE_URL}/c/${slug}` : undefined,
    },
  });
  if (error) {
    return { error: error.code === "user_already_exists" ? "Этот email уже зарегистрирован" : "Не удалось зарегистрироваться" };
  }
  if (!data.session) return { message: "Проверьте почту и подтвердите email, затем войдите" };
  redirect(safeNext(slug, fd.get("next")) ?? `/c/${slug}`);
}

export async function signOut(fd: FormData) {
  const slug = str(fd, "slug");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(slug ? `/c/${slug}/login` : "/admin/login");
}

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) return { error: "Сессия истекла" };
  const fullName = str(fd, "full_name");
  const phone = str(fd, "phone");
  if (fullName.length > 120 || phone.length > 40) return { error: "Слишком длинное имя или телефон" };
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: phone || null })
    .eq("id", data.claims.sub);
  return error ? { error: "Не удалось сохранить" } : { message: "Сохранено" };
}
