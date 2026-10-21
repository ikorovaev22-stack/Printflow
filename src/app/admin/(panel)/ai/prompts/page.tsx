import { PromptForm } from "@/components/admin/ai-prompts";
import { PROMPTS, type PromptKind } from "@/lib/assistant";
import { requireStaff } from "@/lib/auth";

export default async function PromptsPage() {
  const { supabase, company } = await requireStaff();
  const { data } = await supabase.from("ai_prompts").select("kind, body, updated_at").eq("company_id", company.id);
  const saved = new Map((data ?? []).map((p) => [p.kind as PromptKind, p as { body: string; updated_at: string }]));
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Три постоянные инструкции для нейросети. Формат ответа и сведения о типографии сервер добавляет сам — здесь только правила и тон.
      </p>
      {(Object.keys(PROMPTS) as PromptKind[]).map((kind) => (
        <PromptForm key={kind} kind={kind} saved={saved.get(kind) ?? null} />
      ))}
    </div>
  );
}
