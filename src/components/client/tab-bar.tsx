"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, MessageCircle, Package, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function TabBar({ slug, unread = 0 }: { slug: string; unread?: number }) {
  const pathname = usePathname();
  const base = `/c/${slug}`;
  const tabs = [
    { href: base, label: "Заказы", icon: Package, active: pathname === base || pathname.startsWith(`${base}/orders`) },
    { href: `${base}/chat`, label: "Чат", icon: MessageCircle, badge: unread },
    { href: `${base}/faq`, label: "FAQ", icon: HelpCircle },
    { href: `${base}/profile`, label: "Профиль", icon: User },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <div className="mx-auto grid max-w-md grid-cols-4 rounded-full bg-card/95 px-2 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.06)] backdrop-blur-xl">
        {tabs.map((t) => {
          const active = t.active ?? pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "relative flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <t.icon className="size-6" strokeWidth={active ? 2.2 : 1.8} />
              {t.label}
              {!!t.badge && (
                <span className="absolute top-1 left-1/2 ml-2 flex min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-4.5 text-white">
                  {t.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
