import { AppSidebar } from "@/components/admin/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requireStaff } from "@/lib/auth";
import { brandStyle } from "@/lib/brand";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const { profile, company } = await requireStaff();
  return (
    <TooltipProvider>
      <SidebarProvider style={brandStyle(company.brand_color)}>
        <AppSidebar company={company} profile={profile} unread={0} />
        <SidebarInset>
          <header className="flex h-12 items-center border-b px-4 md:hidden">
            <SidebarTrigger />
          </header>
          <div className="mx-auto w-full max-w-6xl p-4 md:p-8">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
