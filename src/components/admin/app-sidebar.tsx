"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, LogOut, MessagesSquare, Package, Settings, Users } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { CompanyLogo } from "@/components/company-logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { initials } from "@/lib/format";
import type { Company, Profile } from "@/lib/types";

export function AppSidebar({ company, profile, unread }: { company: Company; profile: Profile; unread: number }) {
  const pathname = usePathname();
  const items = [
    { href: "/admin/orders", label: "Заказы", icon: Package },
    { href: "/admin/clients", label: "Клиенты", icon: Users },
    { href: "/admin/chat", label: "Чат", icon: MessagesSquare, badge: unread },
    { href: "/admin/faq", label: "Вопросы", icon: CircleHelp },
    ...(profile.role === "owner" ? [{ href: "/admin/settings", label: "Настройки", icon: Settings }] : []),
  ];

  return (
    <Sidebar className="border-none">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <CompanyLogo company={company} className="size-11 rounded-full text-base" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{company.name}</p>
            <p className="text-xs text-muted-foreground">Панель типографии</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className="h-11 rounded-full px-4 text-[15px] data-[active=true]:bg-primary data-[active=true]:font-medium data-[active=true]:text-primary-foreground [&>svg]:size-5"
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {!!item.badge && (
                      <SidebarMenuBadge className="top-3 right-3 rounded-full bg-destructive text-white peer-data-[active=true]/menu-button:text-white">
                        {item.badge}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="flex items-center gap-3 rounded-card bg-muted p-2 pl-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-xs font-semibold">
            {initials(profile.full_name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{profile.full_name}</p>
            <p className="text-xs text-muted-foreground">{profile.role === "owner" ? "Владелец" : "Сотрудник"}</p>
          </div>
          <form action={signOut}>
            <SidebarMenuButton type="submit" className="size-9 justify-center rounded-full p-0 hover:bg-card" aria-label="Выйти" title="Выйти">
              <LogOut />
            </SidebarMenuButton>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
