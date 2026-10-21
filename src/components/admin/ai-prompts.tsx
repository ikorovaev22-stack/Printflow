"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { resetPrompt, savePrompt } from "@/app/actions/assistant";
import { useTimeZone } from "@/components/time-zone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PROMPTS, type PromptKind } from "@/lib/assistant";
import { formatDateTime } from "@/lib/format";

export function PromptForm({ kind, saved }: { kind: PromptKind; saved: { body: string; updated_at: string } | null }) {
  const [state, action, pending] = useActionState(savePrompt, undefined);
  const [body, setBody] = useState(saved?.body ?? PROMPTS[kind].text);
  const [resetting, start] = useTransition();
  const timeZone = useTimeZone();
  const meta = PROMPTS[kind];
  useEffect(() => {
    if (state?.message) toast.success(state.message);
    if (state?.error) toast.error(state.error);
  }, [state]);

  const reset = () =>
    start(async () => {
      try {
        await resetPrompt(kind);
        setBody(PROMPTS[kind].text);
        toast.success("Вернули исходный промпт");
      } catch {
        toast.error("Не удалось вернуть исходный промпт");
      }
    });

  return (
    <form action={action} className="flex flex-col gap-3 rounded-card bg-card p-6">
      <input type="hidden" name="kind" value={kind} />
      <div>
        <Label htmlFor={`prompt-${kind}`} className="text-lg font-semibold">
          {meta.label}
        </Label>
        <p className="mt-1 text-sm text-muted-foreground">
          {meta.hint}. {saved ? `Изменён ${formatDateTime(saved.updated_at, timeZone)}` : "Исходный вариант"}
        </p>
      </div>
      <Textarea
        id={`prompt-${kind}`}
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={8}
        maxLength={8000}
        required
        className="border-transparent bg-muted text-[15px] leading-relaxed"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending || !body.trim()}>
          {pending ? "Сохранение…" : "Сохранить"}
        </Button>
        {saved && (
          <Button type="button" variant="ghost" disabled={resetting} onClick={() => confirm("Вернуть исходный текст промпта?") && reset()}>
            <RotateCcw /> Вернуть исходный
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{body.length} / 8000</span>
      </div>
    </form>
  );
}
