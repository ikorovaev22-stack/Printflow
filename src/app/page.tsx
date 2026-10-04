import Link from "next/link";
import { ArrowUpRight, MessageCircle, MonitorSmartphone, Palette, Smartphone, Timer } from "lucide-react";
import { Halftone } from "@/components/client/halftone";
import { Button } from "@/components/ui/button";
import { STATUSES } from "@/lib/types";
import { cn } from "@/lib/utils";

const features = [
  { icon: Timer, title: "Статусы и сроки", text: "Клиент видит этап и дату готовности сразу, как вы их меняете." },
  { icon: MessageCircle, title: "Чат с менеджером", text: "Вопросы по макету и доставке — в одном окне, без мессенджеров." },
  { icon: Palette, title: "Ваш бренд", text: "Логотип, фирменный цвет и контакты. Иконка на домашнем экране." },
];

export default function Landing() {
  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-6xl px-5 py-6 md:px-8">
        <header className="flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight">PrintFlow</span>
          <Button asChild variant="surface">
            <Link href="/admin">Войти в панель</Link>
          </Button>
        </header>

        <section className="relative mt-6 overflow-hidden rounded-[2rem] bg-primary px-6 py-14 text-primary-foreground md:px-14 md:py-20">
          <Halftone className="-top-24 -right-24 size-[30rem]" />
          <Halftone className="-bottom-40 left-1/3 size-96" />
          <p className="relative inline-flex h-9 items-center rounded-full bg-white/12 px-4 text-sm backdrop-blur-md">
            Меньше звонков «Где мой заказ?»
          </p>
          <h1 className="relative mt-6 max-w-3xl text-4xl leading-[1.05] font-bold tracking-tight md:text-6xl">
            Клиенты типографии сами видят статус заказа
          </h1>
          <p className="relative mt-5 max-w-xl text-lg text-white/60">
            Приложение в вашем бренде: этап и срок готовности, способ получения и чат с менеджером. Ставится на телефон как обычное.
          </p>
          <div className="relative mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="lime">
              <Link href="/c/demo">
                <Smartphone data-icon="inline-start" /> Приложение клиента
              </Link>
            </Button>
            <Button asChild size="lg" variant="glass">
              <Link href="/admin">
                <MonitorSmartphone data-icon="inline-start" /> Панель типографии
              </Link>
            </Button>
          </div>
        </section>

        <section aria-label="Этапы заказа" className="mt-3 flex flex-wrap gap-2 rounded-card bg-card p-4">
          {STATUSES.map((s, i) => (
            <span
              key={s.value}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium",
                s.value === "ready" ? "bg-lime text-lime-foreground" : "bg-muted",
              )}
            >
              <span aria-hidden className={cn("size-2 rounded-full", s.value === "ready" ? "bg-lime-foreground" : s.dot)} />
              {i + 1}. {s.label}
            </span>
          ))}
        </section>

        <section className="mt-3 grid gap-3 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="flex flex-col gap-6 rounded-card bg-card p-6">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                <f.icon className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">{f.title}</h2>
                <p className="mt-1 text-muted-foreground">{f.text}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-3 flex flex-col justify-between gap-4 rounded-card bg-card p-6 md:flex-row md:items-center">
          <div>
            <p className="font-semibold">Демо-доступы</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Сотрудник <span className="font-medium text-foreground">owner@printflow.demo</span> · клиент{" "}
              <span className="font-medium text-foreground">anna@printflow.demo</span> · пароль{" "}
              <span className="font-medium text-foreground">Demo1234!</span>
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/c/demo">
              Открыть демо <ArrowUpRight data-icon="inline-end" />
            </Link>
          </Button>
        </section>
      </div>
    </main>
  );
}
