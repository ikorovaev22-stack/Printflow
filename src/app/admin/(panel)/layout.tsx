import { AppSidebar } from "@/components/admin/app-sidebar";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { StatusesProvider } from "@/components/statuses";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TimeZoneProvider } from "@/components/time-zone";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requireStaff } from "@/lib/auth";
import { brandStyle } from "@/lib/brand";
import { companyStatuses } from "@/lib/types";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const { profile, company, supabase } = await requireStaff();
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("from_client", true)
    .is("read_at", null);
  return (
    <TooltipProvider>
      <SidebarProvider style={brandStyle(company.brand_color)} className="brand-scope">
        <AppSidebar company={company} profile={profile} unread={count ?? 0} />
        <RealtimeRefresh table="messages" filter={`company_id=eq.${company.id}`} />
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 bg-card px-4 md:hidden">
            <SidebarTrigger />
          </header>
          <div className="mx-auto w-full max-w-6xl p-4 md:p-10">
            <TimeZoneProvider value={company.timezone}>
              <StatusesProvider value={companyStatuses(company)}>{children}</StatusesProvider>
            </TimeZoneProvider>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
