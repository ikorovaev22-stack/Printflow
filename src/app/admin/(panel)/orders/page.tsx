import Link from "next/link";
import { Plus } from "lucide-react";
import { OrdersTable, type OrderRow } from "@/components/admin/orders-table";
import { OrdersToolbar } from "@/components/admin/orders-toolbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth";

export const metadata = { title: "Заказы" };

export default async function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const { q, status } = (await searchParams) as { q?: string; status?: string };
  const { supabase } = await requireStaff();

  let query = supabase
    .from("orders")
    .select("*, client:profiles(id, full_name, email)")
    .order("created_at", { ascending: false });
  if (status === "active") query = query.not("status", "in", "(ready,delivered)");
  else if (status) query = query.eq("status", status);
  const { data } = await query.returns<OrderRow[]>();

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
        <Button asChild>
          <Link href="/admin/orders/new">
            <Plus /> Новый заказ
          </Link>
        </Button>
      </PageHeader>
      <OrdersToolbar />
      <OrdersTable orders={orders} />
    </>
  );
}
