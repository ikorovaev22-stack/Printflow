import { AutoresponderForm, TemplatesManager, TestBox } from "@/components/admin/ai-autoresponder";
import { aiConfigured } from "@/lib/assistant-server";
import { requireStaff } from "@/lib/auth";
import type { AiSettings, AiTemplate } from "@/lib/types";

export default async function AutoresponderPage() {
  const { supabase, company } = await requireStaff();
  const [{ data: settings }, { data: templates }] = await Promise.all([
    supabase.from("ai_settings").select("*").eq("company_id", company.id).maybeSingle<AiSettings>(),
    supabase.from("ai_templates").select("*").eq("company_id", company.id).order("position").returns<AiTemplate[]>(),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <AutoresponderForm settings={settings} />
        <TestBox configured={aiConfigured()} />
      </div>
      <TemplatesManager templates={templates ?? []} />
    </div>
  );
}
