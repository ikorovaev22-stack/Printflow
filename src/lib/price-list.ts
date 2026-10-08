import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { parsePriceList, type PriceList } from "@/lib/pricing";

// The company's price list, validated; null when the owner has not set it up (the calculator is then hidden)
export const getPriceList = cache(async (companyId: string): Promise<{ prices: PriceList; updatedAt: string } | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("price_lists").select("config, updated_at").eq("company_id", companyId).maybeSingle();
  if (!data) return null;
  const parsed = parsePriceList(data.config);
  if (!parsed.ok) {
    console.error("invalid price list", companyId, parsed.error);
    return null;
  }
  return { prices: parsed.value, updatedAt: data.updated_at };
});
