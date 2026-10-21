"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, Sparkles, UserRound, X } from "lucide-react";
import { dismissDraft, publishDraft } from "@/app/actions/assistant";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AiDraft } from "@/lib/types";

// The assistant's pending reply in a staff chat: edit and send it, or reject it. A handoff only tells the manager why
export function AiDraftPanel({ draft }: { draft: AiDraft }) {
  const [body, setBody] = useState(draft.body ?? "");
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
    });

  if (draft.handoff) {
    return (
      <div role="status" className="mx-3 mb-2 flex items-start gap-3 rounded-tile bg-amber-100 p-3 text-sm text-amber-950 dark:bg-amber-400/15 dark:text-amber-100">
        <UserRound className="mt-0.5 size-4 shrink-0" />
        <p className="flex-1">
          <span className="font-medium">ИИ передал вопрос вам.</span> {draft.note}
        </p>
        <Button variant="ghost" size="icon-sm" disabled={pending} onClick={() => act(() => dismissDraft(draft.id))} aria-label="Скрыть">
          <X />
        </Button>
      </div>
    );
  }

  return (
    <section aria-label="Черновик ответа ИИ" className="mx-3 mb-2 flex flex-col gap-2 rounded-tile border border-dashed border-primary/40 bg-card p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5" /> Черновик ответа ИИ — проверьте перед отправкой
      </p>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={4000}
        aria-label="Текст черновика"
        className="max-h-48 border-transparent bg-muted text-[15px]"
      />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending || !body.trim()} onClick={() => act(() => publishDraft(draft.id, "", body))}>
          <Send /> Отправить клиенту
        </Button>
        <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={pending} onClick={() => act(() => dismissDraft(draft.id))}>
          <X /> Отклонить
        </Button>
      </div>
    </section>
  );
}
