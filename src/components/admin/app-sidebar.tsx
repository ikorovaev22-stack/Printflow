"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, LogOut, MessagesSquare, Package, Settings, Users } from "lucide-react";
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
import type { Company, Profile } from "@/lib/types";

export function AppSidebar({ company, profile, unread }: { company: Company; profile: Profile; unread: number }) {
  const pathname = usePathname();
  const items = [
    { href: "/admin/orders", label: "Заказы", icon: Package },
    { href: "/admin/clients", label: "Клиенты", icon: Users },
    { href: "/admin/chat", label: "Чат", icon: MessagesSquare, badge: unread },
    { href: "/admin/faq", label: "FAQ", icon: HelpCircle },
    ...(profile.role === "owner" ? [{ href: "/admin/settings", label: "Настройки", icon: Settings }] : []),
  ];

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-2">
          <CompanyLogo company={company} className="size-9 text-base" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{company.name}</p>
            <p className="text-xs text-muted-foreground">PrintFlow</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {!!item.badge && (
                    <SidebarMenuBadge className="bg-primary text-primary-foreground rounded-full">{item.badge}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{profile.full_name}</p>
            <p className="text-xs text-muted-foreground">{profile.role === "owner" ? "Владелец" : "Сотрудник"}</p>
          </div>
          <form action={signOut}>
            <SidebarMenuButton type="submit" className="size-8 justify-center p-0" aria-label="Выйти">
              <LogOut />
            </SidebarMenuButton>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
