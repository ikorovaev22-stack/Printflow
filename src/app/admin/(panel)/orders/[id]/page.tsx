import { notFound } from "next/navigation";
import { DeleteOrderButton } from "@/components/admin/delete-order-button";
import { OrderForm } from "@/components/admin/order-form";
import { PageHeader } from "@/components/admin/page-header";
import { OrderTimeline } from "@/components/client/order-timeline";
import { OrderFiles } from "@/components/order-files";
import { QuoteLines } from "@/components/quote-lines";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { requireStaff } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { companyStatuses, type Order, type OrderEvent, type OrderFile } from "@/lib/types";

export default async function EditOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  const { supabase, company, profile } = await requireStaff();
  const [{ data: order }, { data: clients }, { data: events }, { data: files }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle<Order>(),
    supabase.from("profiles").select("id, full_name, email").eq("role", "client").order("full_name"),
    supabase.from("order_events").select("status, created_at").eq("order_id", id).order("created_at").returns<OrderEvent[]>(),
    supabase.from("order_files").select("*").eq("order_id", id).order("created_at").returns<OrderFile[]>(),
  ]);
  if (!order) notFound();
  return (
    <>
      <RealtimeRefresh table="order_files" filter={`order_id=eq.${order.id}`} />
      <PageHeader title={`Заказ №${order.number}`} description={`Создан ${formatDate(order.created_at, company.timezone)}`}>
        <DeleteOrderButton id={order.id} />
      </PageHeader>
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_360px]">
        <OrderForm order={order} clients={clients ?? []} back="/admin/orders" />
        <aside className="flex flex-col gap-6">
          {order.calc && (
            <section className="rounded-card bg-card p-6">
              <h2 className="font-semibold">Расчёт клиента</h2>
              <p className="mt-1 mb-4 text-sm text-muted-foreground">
                Заявка из калькулятора, цены от {formatDate(order.calc.price_list_updated_at, company.timezone)}
              </p>
              <QuoteLines lines={order.calc.lines} total={order.calc.total} />
            </section>
          )}
          <section className="rounded-card bg-card p-6">
            <h2 className="mb-4 font-semibold">Файлы</h2>
            <OrderFiles orderId={order.id} companyId={order.company_id} files={files ?? []} meId={profile.id} side="staff" />
          </section>
          <section className="rounded-card bg-card p-6">
            <h2 className="mb-4 font-semibold">История этапов</h2>
            <OrderTimeline status={order.status} statuses={companyStatuses(company)} events={events ?? []} timeZone={company.timezone} />
          </section>
        </aside>
      </div>
    </>
  );
}
