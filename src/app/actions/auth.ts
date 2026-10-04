"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string } | undefined;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const slug = str(fd, "slug");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: str(fd, "email"), password: str(fd, "password") });
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
  redirect(isStaff ? "/admin/orders" : `/c/${slug}`);
}

export async function signUp(_: FormState, fd: FormData): Promise<FormState> {
  const slug = str(fd, "slug");
  const password = str(fd, "password");
  if (password.length < 6) return { error: "Пароль должен быть не короче 6 символов" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: str(fd, "email"),
    password,
    options: { data: { company_slug: slug, full_name: str(fd, "full_name"), phone: str(fd, "phone") } },
  });
  if (error) {
    return { error: error.code === "user_already_exists" ? "Этот email уже зарегистрирован" : "Не удалось зарегистрироваться" };
  }
  if (!data.session) return { message: "Проверьте почту и подтвердите email, затем войдите" };
  redirect(`/c/${slug}`);
}

export async function signOut(fd: FormData) {
  const slug = str(fd, "slug");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(slug ? `/c/${slug}/login` : "/admin/login");
}
