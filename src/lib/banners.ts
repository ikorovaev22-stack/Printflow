import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Banner } from "@/lib/types";

export const getBanners = cache(async (companyId: string): Promise<Banner[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("banners").select("*").eq("company_id", companyId).order("position").returns<Banner[]>();
  return data ?? [];
});
