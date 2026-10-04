"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteFaq, moveFaq, saveFaq } from "@/app/actions/company";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Faq } from "@/lib/types";

export function FaqManager({ faqs }: { faqs: Faq[] }) {
  const [editing, setEditing] = useState<Faq | "new" | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        await fn();
      } catch {
        toast.error("Не удалось выполнить действие, обновите страницу");
      }
    });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus /> Добавить вопрос
        </Button>
      </div>
      {!faqs.length && <p className="rounded-card border-2 border-dashed p-12 text-center text-muted-foreground">Вопросов пока нет</p>}
      <ul className="flex flex-col gap-3">
        {faqs.map((f, i) => (
          <li key={f.id} className="flex gap-4 rounded-card bg-card p-6">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{f.question}</p>
              <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{f.answer}</p>
            </div>
            <div className="flex shrink-0 items-start gap-1">
              <Button variant="ghost" size="icon" disabled={pending || i === 0} onClick={() => run(() => moveFaq(f.id, -1))} aria-label="Выше">
                <ArrowUp />
              </Button>
              <Button variant="ghost" size="icon" disabled={pending || i === faqs.length - 1} onClick={() => run(() => moveFaq(f.id, 1))} aria-label="Ниже">
                <ArrowDown />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setEditing(f)} aria-label="Изменить">
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                disabled={pending}
                onClick={() => confirm("Удалить вопрос?") && run(() => deleteFaq(f.id))}
                aria-label="Удалить"
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          {editing && <FaqForm key={editing === "new" ? "new" : editing.id} faq={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FaqForm({ faq, onDone }: { faq?: Faq; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveFaq, undefined);
  useEffect(() => {
    if (state?.message) {
      toast.success("Сохранено");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{faq ? "Изменить вопрос" : "Новый вопрос"}</DialogTitle>
      </DialogHeader>
      {faq && <input type="hidden" name="id" value={faq.id} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="question">Вопрос</Label>
        <Input id="question" name="question" defaultValue={faq?.question} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="answer">Ответ</Label>
        <Textarea id="answer" name="answer" defaultValue={faq?.answer} rows={5} required />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Сохранение…" : "Сохранить"}
        </Button>
      </DialogFooter>
    </form>
  );
}
