import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, MessageCircle, MessageSquareText, Store, Truck } from "lucide-react";
import { OrderTimeline } from "@/components/client/order-timeline";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Screen } from "@/components/client/screen";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { requireClient } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { DELIVERY_LABELS, type Order } from "@/lib/types";

export default async function OrderScreen({ params }: PageProps<"/c/[slug]/orders/[id]">) {
  const { slug, id } = await params;
  const { supabase, company } = await requireClient(slug);
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).maybeSingle<Order>();
  if (!order) notFound();
  const pickup = order.delivery_method === "pickup";

  return (
    <Screen title={order.title} back={`/c/${slug}`}>
      <RealtimeRefresh table="orders" filter={`id=eq.${order.id}`} />
      <div className="-mt-2 mb-5 flex items-center gap-2 text-sm text-muted-foreground">
        Заказ №{order.number} <StatusBadge status={order.status} />
      </div>

      {order.status === "ready" && (
        <div className="mb-4 rounded-2xl bg-emerald-500 p-4 text-white shadow-sm">
          <p className="font-semibold">Заказ готов!</p>
          <p className="text-sm opacity-90">{pickup ? "Можно забирать в часы работы" : "Скоро передадим в доставку"}</p>
        </div>
      )}

      <section className="mb-4 grid grid-cols-2 gap-3">
        <InfoTile icon={CalendarDays} label="Готовность" value={formatDate(order.due_date)} />
        <InfoTile icon={pickup ? Store : Truck} label="Получение" value={DELIVERY_LABELS[order.delivery_method]} />
      </section>

      <section className="mb-4 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        <OrderTimeline status={order.status} />
      </section>

      <section className="mb-4 flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        <Row icon={MapPin} label={pickup ? "Адрес самовывоза" : "Адрес доставки"}>
          {pickup ? company.address || "—" : order.delivery_address || "—"}
        </Row>
        {order.description && <Row icon={MessageSquareText} label="Описание">{order.description}</Row>}
        {order.comment && <Row icon={MessageCircle} label="Комментарий типографии">{order.comment}</Row>}
      </section>

      <Button asChild size="lg" className="h-12 w-full rounded-xl text-base">
        <Link href={`/c/${slug}/chat`}>
          <MessageCircle /> Задать вопрос
        </Link>
      </Button>
    </Screen>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
      <Icon className="mb-2 size-5 text-primary" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function Row({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="whitespace-pre-line">{children}</p>
      </div>
    </div>
  );
}
