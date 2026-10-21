"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AiTabs({ drafts }: { drafts: number }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/admin/ai", label: "Автоответчик" },
    { href: "/admin/ai/knowledge", label: "База знаний" },
    { href: "/admin/ai/publications", label: "Публикации", count: drafts },
    { href: "/admin/ai/prompts", label: "Промпты" },
  ];
  return (
    <nav aria-label="Разделы ИИ-помощника" className="mb-6 flex gap-2 overflow-x-auto [scrollbar-width:none]">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {!!t.count && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white tabular-nums">
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
