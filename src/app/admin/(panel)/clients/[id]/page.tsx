import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MessagesSquare, Phone, Plus } from "lucide-react";
import { OrdersTable, type OrderRow } from "@/components/admin/orders-table";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { requireStaff } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Profile } from "@/lib/types";

export default async function ClientPage({ params }: PageProps<"/admin/clients/[id]">) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const [{ data: client }, { data: orders }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).eq("role", "client").maybeSingle<Profile>(),
    supabase.from("orders").select("*").eq("client_id", id).order("created_at", { ascending: false }).returns<OrderRow[]>(),
  ]);
  if (!client) notFound();

  return (
    <>
      <PageHeader title={client.full_name || "Без имени"} description={`Клиент с ${formatDate(client.created_at)}`}>
        <Button variant="outline" asChild>
          <Link href={`/admin/chat/${client.id}`}>
            <MessagesSquare /> Написать
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/admin/orders/new?client=${client.id}`}>
            <Plus /> Новый заказ
          </Link>
        </Button>
      </PageHeader>
      <div className="mb-6 flex flex-wrap gap-6 rounded-xl border bg-card p-5 text-sm">
        <span className="flex items-center gap-2">
          <Phone className="size-4 text-muted-foreground" />
          {client.phone ? <a href={`tel:${client.phone}`}>{client.phone}</a> : "—"}
        </span>
        <span className="flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          <a href={`mailto:${client.email}`}>{client.email}</a>
        </span>
      </div>
      <h2 className="mb-3 text-lg font-semibold">Заказы</h2>
      <OrdersTable orders={(orders ?? []).map((o) => ({ ...o, client: null }))} showClient={false} />
    </>
  );
}
