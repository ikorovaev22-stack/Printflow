"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, Lightbulb, PenLine, Sparkles, Trash2, X } from "lucide-react";
import { createDraft, deletePost, dismissDraft, publishDraft, suggestFaqDrafts } from "@/app/actions/assistant";
import { useTimeZone } from "@/components/time-zone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDateTime } from "@/lib/format";
import type { AiDraft, Post } from "@/lib/types";

const KIND_LABELS = { post: "Новость", faq: "Вопрос и ответ" } as const;

export function DraftComposer({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(createDraft, undefined);
  const [kind, setKind] = useState<"post" | "faq">("post");
  const [suggesting, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.message) {
      toast.success(state.message);
      form.current?.reset();
    }
    if (state?.error) toast.error(state.error);
  }, [state]);

  const suggest = () =>
    start(async () => {
      const res = await suggestFaqDrafts();
      if (res.error) toast.error(res.error);
      else toast.success(res.count ? `Предложено вопросов: ${res.count} — проверьте ниже` : "Новых вопросов не нашлось");
    });

  return (
    <section className="flex flex-col gap-4 rounded-card bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Новый черновик</h2>
          <p className="mt-1 text-sm text-muted-foreground">Клиенты увидят публикацию только после того, как вы её проверите и подтвердите.</p>
        </div>
        <Button variant="outline" disabled={!configured || suggesting} onClick={suggest}>
          <Lightbulb /> {suggesting ? "Читаем переписки…" : "Предложить вопросы по перепискам"}
        </Button>
      </div>
      <form ref={form} action={action} className="flex flex-col gap-3">
        <input type="hidden" name="kind" value={kind} />
        <ToggleGroup
          type="single"
          value={kind}
          onValueChange={(v) => v && setKind(v as "post" | "faq")}
          aria-label="Что публикуем"
          className="w-fit rounded-full bg-muted p-1"
        >
          {(["post", "faq"] as const).map((k) => (
            <ToggleGroupItem key={k} value={k} className="h-9 rounded-full px-4 data-[state=on]:bg-card data-[state=on]:shadow-sm">
              {k === "post" ? "Новость или акция" : "Вопрос для раздела «Вопросы»"}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Label htmlFor="draft-topic" className="sr-only">
          О чём написать
        </Label>
        <Textarea
          id="draft-topic"
          name="topic"
          rows={4}
          maxLength={5000}
          required
          placeholder={
            kind === "post"
              ? "О чём новость: «скидка 10% на визитки до конца ноября», «работаем 4 ноября». Или напишите текст сами — первая строка станет заголовком"
              : "О чём вопрос: «можно ли прислать макет в Word». Или напишите сами: первая строка — вопрос, дальше ответ"
          }
          className="border-transparent bg-muted"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="with" value="ai" disabled={!configured || pending}>
            <Sparkles /> {pending ? "Пишем…" : "Написать с ИИ"}
          </Button>
          <Button type="submit" name="with" value="manual" variant="outline" disabled={pending}>
            <PenLine /> Сохранить мой текст
          </Button>
        </div>
      </form>
    </section>
  );
}

export function DraftQueue({ drafts }: { drafts: AiDraft[] }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">На проверке{drafts.length ? ` · ${drafts.length}` : ""}</h2>
      {!drafts.length && <p className="rounded-card border-2 border-dashed p-8 text-center text-sm text-muted-foreground">Черновиков нет</p>}
      {drafts.map((d) => (
        <DraftCard key={d.id} draft={d} />
      ))}
    </section>
  );
}

function DraftCard({ draft }: { draft: AiDraft }) {
  const [title, setTitle] = useState(draft.title ?? "");
  const [body, setBody] = useState(draft.body ?? "");
  const [pending, start] = useTransition();
  const timeZone = useTimeZone();
  const faq = draft.kind === "faq";

  const publish = () =>
    start(async () => {
      const res = await publishDraft(draft.id, title, body);
      if (res.error) toast.error(res.error);
      else toast.success(faq ? "Вопрос добавлен в раздел «Вопросы»" : "Новость опубликована");
    });
  const dismiss = () =>
    start(async () => {
      const res = await dismissDraft(draft.id);
      if (res.error) toast.error(res.error);
    });

  return (
    <article aria-label={`Черновик: ${KIND_LABELS[draft.kind as "post" | "faq"]}`} className="flex flex-col gap-3 rounded-card bg-card p-6">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{KIND_LABELS[draft.kind as "post" | "faq"]}</span> · {formatDateTime(draft.created_at, timeZone)}
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`title-${draft.id}`}>{faq ? "Вопрос" : "Заголовок"}</Label>
        <Input id={`title-${draft.id}`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={faq ? 300 : 200} className="border-transparent bg-muted" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`body-${draft.id}`}>{faq ? "Ответ" : "Текст"}</Label>
        <Textarea id={`body-${draft.id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={faq ? 4 : 8} maxLength={5000} className="border-transparent bg-muted" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={publish} disabled={pending || !title.trim() || !body.trim()}>
          <Check /> Опубликовать
        </Button>
        <Button variant="ghost" onClick={dismiss} disabled={pending} className="text-muted-foreground">
          <X /> Отклонить
        </Button>
      </div>
    </article>
  );
}

export function PostsList({ posts, slug }: { posts: Post[]; slug: string }) {
  const timeZone = useTimeZone();
  const [pending, start] = useTransition();
  const remove = (id: string) =>
    start(async () => {
      try {
        await deletePost(id);
      } catch {
        toast.error("Не удалось удалить новость");
      }
    });

  return (
    <section className="flex flex-col gap-4 rounded-card bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Опубликованные новости</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href={`/c/${slug}/news`} target="_blank">
            <ExternalLink /> Как видят клиенты
          </Link>
        </Button>
      </div>
      {!posts.length && <p className="text-sm text-muted-foreground">Новостей пока нет</p>}
      <ul className="flex flex-col divide-y">
        {posts.map((p) => (
          <li key={p.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{p.title}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(p.created_at, timeZone)}</p>
              <p className="mt-1 line-clamp-3 text-sm whitespace-pre-line text-muted-foreground">{p.body}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-destructive"
              disabled={pending}
              onClick={() => confirm("Удалить новость? Клиенты перестанут её видеть.") && remove(p.id)}
              aria-label="Удалить новость"
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
