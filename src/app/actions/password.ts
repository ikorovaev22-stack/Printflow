"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/app/actions/auth";
import { SITE_URL } from "@/lib/config";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Укажите email" };
  if (!rateLimit(`reset:${await clientIp()}`, 5, 15 * 60_000) || !rateLimit(`reset:${email}`, 3, 15 * 60_000)) {
    return { error: "Слишком много запросов. Попробуйте через 15 минут" };
  }
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, SITE_URL ? { redirectTo: `${SITE_URL}/auth/reset` } : undefined);
  // Same answer whether or not the address exists
  return { message: "Если такой email зарегистрирован, мы отправили на него ссылку для смены пароля" };
}

export async function updatePassword(_: FormState, fd: FormData): Promise<FormState> {
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "Пароль должен быть не короче 8 символов" };
  if (password.length > 72) return { error: "Пароль слишком длинный" };
  if (password !== String(fd.get("confirm") ?? "")) return { error: "Пароли не совпадают" };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) return { error: "Ссылка устарела. Запросите новую" };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.code === "same_password" ? "Новый пароль совпадает со старым" : "Не удалось сменить пароль" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company:companies(slug)")
    .eq("id", claims.claims.sub)
    .single<{ role: string; company: { slug: string } }>();
  redirect(!profile ? "/" : profile.role === "client" ? `/c/${profile.company.slug}` : "/admin/orders");
}
