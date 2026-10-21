"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Globe, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { addPage, deleteKnowledge, refreshPage, saveKnowledge, toggleKnowledge } from "@/app/actions/assistant";
import { useTimeZone } from "@/components/time-zone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import type { AiKnowledge } from "@/lib/types";

export function KnowledgeManager({ entries }: { entries: AiKnowledge[] }) {
  const [editing, setEditing] = useState<AiKnowledge | "new" | null>(null);
  return (
    <section className="flex flex-col gap-4 rounded-card bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">База знаний</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Записи, которые вы пишете сами, и страницы сайта типографии. Выключенную запись ИИ не читает.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus /> Добавить запись
        </Button>
      </div>
      <PageReader />
      {!entries.length && <p className="rounded-tile border-2 border-dashed p-8 text-center text-sm text-muted-foreground">Записей пока нет</p>}
      <ul className="flex flex-col gap-3">
        {entries.map((e) => (
          <Entry key={e.id} entry={e} onEdit={() => setEditing(e)} />
        ))}
      </ul>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          {editing && <EntryForm key={editing === "new" ? "new" : editing.id} entry={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}

// A public page of the print shop's site: the server reads it and the model keeps what matters for clients
function PageReader() {
  const [state, action, pending] = useActionState(addPage, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.message) {
      toast.success(state.message);
      form.current?.reset();
    }
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-2 rounded-tile bg-muted/60 p-4">
      <Label htmlFor="page-url">Прочитать страницу сайта</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id="page-url" name="url" type="url" inputMode="url" required placeholder="https://ваш-сайт.ru/uslugi" maxLength={2000} className="bg-card" />
        <Button type="submit" variant="outline" disabled={pending} className="shrink-0 bg-card">
          <Globe /> {pending ? "Читаем страницу…" : "Прочитать"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Только открытые страницы. Если на сайте что-то поменялось — нажмите «Обновить» у записи.</p>
    </form>
  );
}

function Entry({ entry, onEdit }: { entry: AiKnowledge; onEdit: () => void }) {
  const timeZone = useTimeZone();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, error: string) =>
    start(async () => {
      try {
        const res = await fn();
        if (res && typeof res === "object" && "error" in res && res.error) toast.error(String(res.error));
      } catch {
        toast.error(error);
      }
    });
  const host = entry.url && new URL(entry.url).hostname;

  return (
    <li className="flex flex-col gap-3 rounded-tile border p-4" data-disabled={!entry.enabled || undefined}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium break-words">{entry.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entry.url ? (
              <>
                <a href={entry.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  {host}
                </a>
                {entry.fetched_at && ` · прочитана ${formatDate(entry.fetched_at, timeZone)}`}
              </>
            ) : (
              "Написано вручную"
            )}
          </p>
        </div>
        <Switch
          checked={entry.enabled}
          disabled={pending}
          onCheckedChange={(v) => run(() => toggleKnowledge(entry.id, v), "Не удалось сохранить")}
          aria-label={entry.enabled ? "ИИ читает запись" : "Запись выключена"}
        />
      </div>
      <p className={entry.enabled ? "line-clamp-4 text-sm whitespace-pre-line text-muted-foreground" : "line-clamp-2 text-sm whitespace-pre-line text-muted-foreground/60"}>
        {entry.body}
      </p>
      <div className="flex flex-wrap gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil /> Изменить
        </Button>
        {entry.url && (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => refreshPage(entry.id), "Не удалось обновить")}>
            <RefreshCw /> {pending ? "Обновляем…" : "Обновить"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={pending}
          onClick={() => confirm("Удалить запись из базы знаний?") && run(() => deleteKnowledge(entry.id), "Не удалось удалить")}
        >
          <Trash2 /> Удалить
        </Button>
      </div>
    </li>
  );
}

function EntryForm({ entry, onDone }: { entry?: AiKnowledge; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveKnowledge, undefined);
  useEffect(() => {
    if (state?.message) {
      toast.success("Сохранено");
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{entry ? "Изменить запись" : "Новая запись"}</DialogTitle>
      </DialogHeader>
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <div className="flex flex-col gap-2">
        <Label htmlFor="knowledge-title">Заголовок</Label>
        <Input id="knowledge-title" name="title" defaultValue={entry?.title} maxLength={200} required placeholder="Требования к макетам" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="knowledge-body">Текст</Label>
        <Textarea
          id="knowledge-body"
          name="body"
          defaultValue={entry?.body}
          rows={12}
          maxLength={20000}
          required
          placeholder="PDF или TIFF, 300 dpi, вылеты по 2 мм, шрифты в кривых…"
          className="max-h-[50vh]"
        />
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
