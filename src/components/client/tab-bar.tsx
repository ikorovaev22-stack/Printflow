"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, MessageCircle, Package, User } from "lucide-react";
import { cn } from "@/lib/utils";

// Floating bar pinned above the home indicator; shared by the tab bar and screen-level action bars
export function FloatingBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <div className={cn("pointer-events-auto mx-auto flex max-w-md items-center rounded-full bg-card p-1.5 shadow-float", className)}>
        {children}
      </div>
    </div>
  );
}

export function TabBar({ slug, unread = 0 }: { slug: string; unread?: number }) {
  const pathname = usePathname();
  const base = `/c/${slug}`;
  // Order detail and the calculator have their own action bars
  if (pathname.startsWith(`${base}/orders/`) || pathname === `${base}/calculator`) return null;

  const tabs = [
    { href: base, label: "Заказы", icon: Package, active: pathname === base },
    { href: `${base}/chat`, label: "Чат", icon: MessageCircle, badge: unread },
    { href: `${base}/faq`, label: "Вопросы", icon: CircleHelp, active: pathname.startsWith(`${base}/faq`) || pathname.startsWith(`${base}/about`) },
    { href: `${base}/profile`, label: "Профиль", icon: User },
  ];
  return (
    <nav aria-label="Разделы">
      <FloatingBar className="justify-between">
        {tabs.map((t) => {
          const active = t.active ?? pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              aria-label={active ? undefined : t.label}
              className={cn(
                "relative flex h-12 items-center justify-center gap-2 rounded-full text-sm font-medium transition-[background-color,color,padding] duration-200 motion-reduce:transition-none",
                active ? "bg-primary px-5 text-primary-foreground" : "w-14 text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-5.5" strokeWidth={active ? 2.2 : 1.8} />
              {active && t.label}
              {!!t.badge && (
                <span className="absolute top-1.5 right-2.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white ring-2 ring-card">
                  {t.badge > 9 ? "9+" : t.badge}
                  <span className="sr-only"> непрочитанных</span>
                </span>
              )}
            </Link>
          );
        })}
      </FloatingBar>
    </nav>
  );
}
