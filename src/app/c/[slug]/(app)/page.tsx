import Link from "next/link";
import { CalendarDays, ChevronRight, Package } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { OrderProgress } from "@/components/client/order-timeline";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Screen } from "@/components/client/screen";
import { StatusBadge } from "@/components/status-badge";
import { requireClient } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Order } from "@/lib/types";

export const metadata = { title: "Мои заказы" };

export default async function OrdersScreen({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const { supabase, profile, company } = await requireClient(slug);
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("client_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<Order[]>();
  const orders = data ?? [];
  const active = orders.filter((o) => o.status !== "delivered");
  const done = orders.filter((o) => o.status === "delivered");

  return (
    <Screen title="Мои заказы" action={<CompanyLogo company={company} />}>
      <RealtimeRefresh table="orders" filter={`client_id=eq.${profile.id}`} />
      {!orders.length && (
        <div className="mt-16 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <Package className="size-12 opacity-40" />
          <p>Здесь появятся ваши заказы</p>
        </div>
      )}
      {!!active.length && <OrderList slug={slug} orders={active} />}
      {!!done.length && (
        <>
          <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">Выданные</h2>
          <OrderList slug={slug} orders={done} muted />
        </>
      )}
    </Screen>
  );
}

function OrderList({ slug, orders, muted }: { slug: string; orders: Order[]; muted?: boolean }) {
  return (
    <ul className="flex flex-col gap-3">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            href={`/c/${slug}/orders/${o.id}`}
            className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/5 transition active:scale-[0.98] dark:ring-white/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Заказ №{o.number}</p>
                <p className={muted ? "font-medium text-muted-foreground" : "font-semibold"}>{o.title}</p>
              </div>
              <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground/60" />
            </div>
            {!muted && <OrderProgress status={o.status} />}
            <div className="flex items-center justify-between">
              <StatusBadge status={o.status} />
              {o.due_date && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CalendarDays className="size-4" />
                  {formatDate(o.due_date)}
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
