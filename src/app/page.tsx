import Link from "next/link";
import { ArrowRight, MessageCircle, MonitorSmartphone, Package, Palette, PhoneOff, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-indigo-50 to-white dark:from-indigo-950/40 dark:to-background">
      <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
          <PhoneOff className="size-4" /> Меньше звонков «Где мой заказ?»
        </div>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          PrintFlow — клиенты сами видят статус заказа
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Приложение для клиентов типографии в вашем бренде: статус и срок готовности, способ получения и чат с менеджером.
          Ставится на телефон как обычное приложение.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="h-12 bg-indigo-600 px-6 text-base hover:bg-indigo-700">
            <Link href="/c/demo">
              <Smartphone /> Приложение клиента
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
            <Link href="/admin">
              <MonitorSmartphone /> Панель типографии <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            { icon: Package, title: "Статусы заказов", text: "Принят → Макет → Печать → Постпечать → Готов → Выдан. Клиент видит изменения сразу." },
            { icon: MessageCircle, title: "Чат в реальном времени", text: "Вопросы по макету и срокам — в одном окне, без мессенджеров и звонков." },
            { icon: Palette, title: "Ваш бренд", text: "Логотип, фирменный цвет и контакты типографии. Иконка на домашнем экране." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-sm">
              <f.icon className="mb-3 size-6 text-indigo-600" />
              <h2 className="font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-dashed bg-card/60 p-6 text-sm">
          <p className="mb-2 font-semibold">Демо-доступы (пароль у всех: Demo1234!)</p>
          <ul className="grid gap-1 text-muted-foreground md:grid-cols-2">
            <li>Сотрудник: <span className="font-mono text-foreground">owner@printflow.demo</span></li>
            <li>Клиент: <span className="font-mono text-foreground">anna@printflow.demo</span></li>
          </ul>
        </div>
      </div>
    </main>
  );
}
