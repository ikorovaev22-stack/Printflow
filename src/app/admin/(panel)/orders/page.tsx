import Link from "next/link";
import { CircleAlert, PackageCheck, Plus, Timer } from "lucide-react";
import { OrdersTable, type OrderRow } from "@/components/admin/orders-table";
import { OrdersToolbar } from "@/components/admin/orders-toolbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

export const metadata = { title: "Заказы" };

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const { q, status } = (await searchParams) as { q?: string; status?: string };
  const { supabase, company } = await requireStaff();

  let query = supabase
    .from("orders")
    .select("*, client:profiles(id, full_name, email), files:order_files(count)")
    .order("created_at", { ascending: false });
  const today = todayISO(company.timezone);
  if (status === "active") query = query.not("status", "in", "(ready,delivered)");
  else if (status === "overdue") query = query.not("status", "in", "(ready,delivered)").lt("due_date", today);
  else if (status) query = query.eq("status", status);
  const [{ data }, { data: all }] = await Promise.all([
    query.returns<OrderRow[]>(),
    supabase.from("orders").select("status, due_date").returns<{ status: OrderStatus; due_date: string | null }[]>(),
  ]);
  const open = (all ?? []).filter((o) => o.status !== "ready" && o.status !== "delivered");
  const stats = [
    { label: "В работе", value: open.length, icon: Timer, href: "/admin/orders?status=active" },
    { label: "Готовы к выдаче", value: (all ?? []).filter((o) => o.status === "ready").length, icon: PackageCheck, href: "/admin/orders?status=ready", lime: true },
    { label: "Просрочены", value: open.filter((o) => o.due_date && o.due_date < today).length, icon: CircleAlert, href: "/admin/orders?status=overdue" },
  ];

  const needle = q?.toLowerCase().replace(/^#/, "");
  const orders = (data ?? []).filter(
    (o) =>
      !needle ||
      String(o.number) === needle ||
      o.title.toLowerCase().includes(needle) ||
      o.client?.full_name.toLowerCase().includes(needle) ||
      o.client?.email?.toLowerCase().includes(needle),
  );

  return (
    <>
      <PageHeader title="Заказы" description={`Всего: ${orders.length}`}>
        <Button asChild size="lg">
          <Link href="/admin/orders/new">
            <Plus data-icon="inline-start" /> Новый заказ
          </Link>
        </Button>
      </PageHeader>
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {stats.map((st) => (
          <Link
            key={st.label}
            href={st.href}
            className={cn(
              "flex items-center justify-between gap-4 rounded-card p-5 transition-opacity hover:opacity-90",
              st.lime ? "bg-lime text-lime-foreground" : "bg-card",
            )}
          >
            <div>
              <p className={cn("text-sm", st.lime ? "opacity-70" : "text-muted-foreground")}>{st.label}</p>
              <p className="mt-1 text-[32px] leading-none font-bold tabular-nums">{st.value}</p>
            </div>
            <span className={cn("flex size-12 items-center justify-center rounded-full", st.lime ? "bg-lime-foreground text-lime" : "bg-muted")}>
              <st.icon className="size-5" />
            </span>
          </Link>
        ))}
      </div>
      <OrdersToolbar />
      <OrdersTable orders={orders} />
    </>
  );
}
