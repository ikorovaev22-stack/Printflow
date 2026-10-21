"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Send, Trash2, UserRound } from "lucide-react";
import { deleteTemplate, saveAiSettings, saveTemplate, testAnswer } from "@/app/actions/assistant";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AI_MODES, DEFAULT_HANDOFF_TEXT, type ReplyDecision } from "@/lib/assistant";
import type { AiSettings, AiTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AutoresponderForm({ settings }: { settings: AiSettings | null }) {
  const [state, action, pending] = useActionState(saveAiSettings, undefined);
  const [mode, setMode] = useState(settings?.mode ?? "off");
  useEffect(() => {
    if (state?.message) toast.success(state.message);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-5 rounded-card bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold">Автоответчик в чате</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Отвечает по шаблонам, базе знаний и заказам клиента. Пока менеджер переписывается с клиентом, ИИ в этом чате молчит.
        </p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Режим</legend>
        {AI_MODES.map((m) => (
          <label
            key={m.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-tile border-2 p-4 transition-colors",
              mode === m.value ? "border-primary" : "border-transparent bg-muted/60 hover:bg-muted",
            )}
          >
            <input type="radio" name="mode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} className="mt-1 accent-primary" />
            <span>
              <span className="block font-medium">{m.label}</span>
              <span className="block text-sm text-muted-foreground">{m.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="handoff_text">Сообщение клиенту, когда вопрос передан менеджеру</Label>
        <Textarea
          id="handoff_text"
          name="handoff_text"
          rows={2}
          maxLength={500}
          defaultValue={settings?.handoff_text ?? DEFAULT_HANDOFF_TEXT}
          className="border-transparent bg-muted"
        />
        <p className="text-xs text-muted-foreground">В режиме «Отвечает сам». В режиме «Черновики» клиенту ничего не уходит без менеджера.</p>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Сохранение…" : "Сохранить"}
        </Button>
      </div>
    </form>
  );
}

// What the autoresponder would answer right now; nothing reaches clients
export function TestBox({ configured }: { configured: boolean }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<{ q: string; decision: ReplyDecision } | null>(null);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const res = await testAnswer(question);
      if (res.error) toast.error(res.error);
      else if (res.decision) setResult({ q: question.trim(), decision: res.decision });
    });

  return (
    <section className="flex flex-col gap-4 rounded-card bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold">Проверка ответа</h2>
        <p className="mt-1 text-sm text-muted-foreground">Напишите вопрос, как его задал бы клиент. Ответ никуда не отправляется.</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="flex flex-col gap-3"
      >
        <Label htmlFor="test-question" className="sr-only">
          Вопрос клиента
        </Label>
        <Textarea
          id="test-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Сколько стоят визитки и когда будут готовы?"
          className="border-transparent bg-muted"
        />
        <div>
          <Button type="submit" disabled={!configured || pending || !question.trim()}>
            <Send /> {pending ? "Нейросеть думает…" : "Проверить ответ"}
          </Button>
        </div>
      </form>
      {result && (
        <div aria-live="polite" className="flex flex-col gap-2 border-t pt-4">
          <p className="ml-auto max-w-[85%] rounded-[1.375rem] rounded-br-md bg-muted px-4 py-2.5 text-[15px]">{result.q}</p>
          {result.decision.action === "answer" ? (
            <div className="max-w-[85%]">
              <p className="text-xs text-muted-foreground">Ответ ИИ</p>
              <p className="mt-1 rounded-[1.375rem] rounded-bl-md bg-primary px-4 py-2.5 text-[15px] whitespace-pre-wrap text-primary-foreground">
                {result.decision.answer}
              </p>
            </div>
          ) : (
            <p className="flex items-start gap-2 rounded-tile bg-amber-100 p-4 text-sm text-amber-950 dark:bg-amber-400/15 dark:text-amber-100">
              <UserRound className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-medium">Передаст менеджеру.</span> {result.decision.reason}
              </span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export function TemplatesManager({ templates }: { templates: AiTemplate[] }) {
  const [editing, setEditing] = useState<AiTemplate | "new" | null>(null);
  const [pending, start] = useTransition();
  const remove = (id: string) =>
    start(async () => {
      try {
        await deleteTemplate(id);
      } catch {
        toast.error("Не удалось удалить шаблон");
      }
    });

  return (
    <section className="flex flex-col gap-4 rounded-card bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Шаблоны вопросов и ответов</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Если клиент спрашивает о том же, ИИ отвечает текстом шаблона. Раздел «Вопросы» из приложения ИИ тоже знает.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus /> Добавить шаблон
        </Button>
      </div>
      {!templates.length && <p className="rounded-tile border-2 border-dashed p-8 text-center text-sm text-muted-foreground">Шаблонов пока нет</p>}
      <ul className="flex flex-col divide-y">
        {templates.map((t) => (
          <li key={t.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t.question}</p>
              <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{t.answer}</p>
            </div>
            <div className="flex shrink-0 items-start gap-1">
              <Button variant="ghost" size="icon" onClick={() => setEditing(t)} aria-label="Изменить шаблон">
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                disabled={pending}
                onClick={() => confirm("Удалить шаблон?") && remove(t.id)}
                aria-label="Удалить шаблон"
              >
                <Trash2 />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          {editing && (
            <TemplateForm key={editing === "new" ? "new" : editing.id} template={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function TemplateForm({ template, onDone }: { template?: AiTemplate; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveTemplate, undefined);
  useEffect(() => {
    if (state?.message) {
      toast.success("Шаблон сохранён");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{template ? "Изменить шаблон" : "Новый шаблон"}</DialogTitle>
      </DialogHeader>
      {template && <input type="hidden" name="id" value={template.id} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="template-question">Вопрос клиента</Label>
        <Input id="template-question" name="question" defaultValue={template?.question} maxLength={500} required placeholder="Можно ли оплатить по счёту?" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="template-answer">Ответ</Label>
        <Textarea id="template-answer" name="answer" defaultValue={template?.answer} rows={5} maxLength={4000} required />
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
