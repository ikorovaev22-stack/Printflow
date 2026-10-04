import Link from "next/link";
import { OrdersToolbar } from "@/components/admin/orders-toolbar";
import { PageHeader } from "@/components/admin/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { OrderStatus, Profile } from "@/lib/types";

export const metadata = { title: "Клиенты" };

type ClientRow = Profile & { orders: { status: OrderStatus }[] };

export default async function ClientsPage({ searchParams }: PageProps<"/admin/clients">) {
  const { q } = (await searchParams) as { q?: string };
  const { supabase } = await requireStaff();
  const { data } = await supabase
    .from("profiles")
    .select("*, orders(status)")
    .eq("role", "client")
    .order("created_at", { ascending: false })
    .returns<ClientRow[]>();

  const needle = q?.toLowerCase();
  const clients = (data ?? []).filter(
    (c) => !needle || [c.full_name, c.email, c.phone].some((v) => v?.toLowerCase().includes(needle)),
  );

  return (
    <>
      <PageHeader title="Клиенты" description={`Всего: ${clients.length}`} />
      <OrdersToolbar withStatus={false} />
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Имя</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">В работе</TableHead>
              <TableHead className="text-right">Всего заказов</TableHead>
              <TableHead className="pr-4 text-right">С нами с</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="pl-4">
                  <Link href={`/admin/clients/${c.id}`} className="font-medium hover:underline">
                    {c.full_name || "Без имени"}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.phone || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.email}</TableCell>
                <TableCell className="text-right">
                  {c.orders.filter((o) => o.status !== "ready" && o.status !== "delivered").length}
                </TableCell>
                <TableCell className="text-right">{c.orders.length}</TableCell>
                <TableCell className="pr-4 text-right text-muted-foreground">{formatDate(c.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
