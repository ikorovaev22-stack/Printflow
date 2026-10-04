import { notFound } from "next/navigation";
import { DeleteOrderButton } from "@/components/admin/delete-order-button";
import { OrderForm } from "@/components/admin/order-form";
import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Order } from "@/lib/types";

export default async function EditOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const [{ data: order }, { data: clients }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle<Order>(),
    supabase.from("profiles").select("id, full_name, email").eq("role", "client").order("full_name"),
  ]);
  if (!order) notFound();
  return (
    <>
      <PageHeader title={`Заказ №${order.number}`} description={`Создан ${formatDate(order.created_at)}`}>
        <DeleteOrderButton id={order.id} />
      </PageHeader>
      <OrderForm order={order} clients={clients ?? []} back="/admin/orders" />
    </>
  );
}
