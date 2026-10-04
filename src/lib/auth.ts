import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Company, Profile } from "@/lib/types";

export const getCompanyBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("*").eq("slug", slug).maybeSingle<Company>();
  return data;
});

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, company:companies(*)")
    .eq("id", userId)
    .maybeSingle<Profile & { company: Company }>();
  return profile ? { supabase, profile, company: profile.company } : null;
});

export async function requireStaff() {
  const session = await getSession();
  if (!session || session.profile.role === "client") redirect("/admin/login");
  return session;
}

export async function requireClient(slug: string) {
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const session = await getSession();
  if (!session || session.company.id !== company.id) redirect(`/c/${slug}/login`);
  if (session.profile.role !== "client") redirect("/admin/orders");
  return session;
}
