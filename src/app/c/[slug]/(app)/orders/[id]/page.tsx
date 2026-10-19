import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, CalendarPlus, MapPin, MessageCircle, Store, Truck } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { Halftone } from "@/components/client/halftone";
import { OrderProgress, OrderTimeline } from "@/components/client/order-timeline";
import { OrderFiles } from "@/components/order-files";
import { QuoteLines } from "@/components/quote-lines";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Screen, SectionTitle } from "@/components/client/screen";
import { FloatingBar } from "@/components/client/tab-bar";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { requireClient } from "@/lib/auth";
import { formatDate, formatRub } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DELIVERY_LABELS, companyStatuses, type Order, type OrderEvent, type OrderFile } from "@/lib/types";

export default async function OrderScreen({ params }: PageProps<"/c/[slug]/orders/[id]">) {
  const { slug, id } = await params;
  const { supabase, company, profile } = await requireClient(slug);
  const [{ data: order }, { data: events }, { data: files }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle<Order>(),
    supabase.from("order_events").select("status, created_at").eq("order_id", id).order("created_at").returns<OrderEvent[]>(),
    supabase.from("order_files").select("*").eq("order_id", id).order("created_at").returns<OrderFile[]>(),
  ]);
  if (!order) notFound();
  const tz = company.timezone;
  const statuses = companyStatuses(company);
  const pickup = order.delivery_method === "pickup";
  const ready = order.status === "ready";
  const delivered = order.status === "delivered";
  const address = pickup ? company.address : order.delivery_address;

  return (
    <Screen back={`/c/${slug}`} className="pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <RealtimeRefresh table="orders" filter={`id=eq.${order.id}`} />
      <RealtimeRefresh table="order_files" filter={`order_id=eq.${order.id}`} />

      <section
        className={cn(
          "relative flex flex-col gap-6 overflow-hidden rounded-card p-6",
          ready ? "bg-lime text-lime-foreground" : "bg-hero text-hero-foreground",
        )}
      >
        {!ready && <Halftone />}
        <div className="relative">
          <p className={cn("text-sm", ready ? "opacity-70" : "text-white/60")}>Заказ №{order.number}</p>
          <h1 className="mt-1 text-[28px] leading-tight font-bold tracking-tight">{order.title}</h1>
          {ready && (
            <p className="mt-2 font-medium">{pickup ? "Готов — можно забирать в часы работы" : "Готов — скоро передадим в доставку"}</p>
          )}
        </div>
        <div className="relative flex flex-col gap-4">
          <OrderProgress status={order.status} statuses={statuses} tone={ready ? "ink" : "light"} />
          {!ready && (
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={order.status} tone="glass" />
            </div>
          )}
        </div>
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3">
        <Fact icon={CalendarDays} label="Готовность" value={formatDate(order.due_date)} />
        <Fact icon={pickup ? Store : Truck} label="Получение" value={DELIVERY_LABELS[order.delivery_method]} />
      </section>

      {order.price !== null && (
        <>
          <SectionTitle>Стоимость</SectionTitle>
          <div className="rounded-card bg-card p-5">
            {order.calc && order.calc.total === order.price ? (
              <QuoteLines lines={order.calc.lines} total={order.price} />
            ) : (
              <p className="text-2xl font-semibold tabular-nums">{formatRub(order.price)}</p>
            )}
            {order.calc && order.calc.total !== order.price && (
              <p className="mt-2 text-sm text-muted-foreground">Менеджер уточнил цену. По калькулятору было {formatRub(order.calc.total)}</p>
            )}
            {order.calc && order.calc.total === order.price && (
              <p className="mt-4 text-sm text-muted-foreground">Цена предварительная: менеджер подтвердит её после проверки макета</p>
            )}
          </div>
        </>
      )}

      <SectionTitle>Этапы</SectionTitle>
      <div className="rounded-card bg-card p-5">
        <OrderTimeline status={order.status} statuses={statuses} events={events ?? []} timeZone={tz} />
      </div>

      <SectionTitle>Файлы</SectionTitle>
      <div className="rounded-card bg-card p-5">
        <OrderFiles orderId={order.id} companyId={order.company_id} files={files ?? []} meId={profile.id} side="client" />
      </div>

      <SectionTitle>Детали</SectionTitle>
      <dl className="flex flex-col gap-5 rounded-card bg-card p-5">
        <Detail icon={MapPin} label={pickup ? "Адрес самовывоза" : "Адрес доставки"}>
          {address || "Уточним в чате"}
        </Detail>
        <Detail icon={CalendarPlus} label="Оформлен">
          {formatDate(order.created_at, tz)}
        </Detail>
        {order.description && (
          <Detail icon={MessageCircle} label={order.source === "calculator" ? "Ваш комментарий" : "Описание"}>
            {order.description}
          </Detail>
        )}
      </dl>

      {order.comment && (
        <>
          <SectionTitle>Комментарий типографии</SectionTitle>
          <figure className="rounded-card bg-card p-5">
            <figcaption className="mb-3 flex items-center gap-3">
              <CompanyLogo company={company} className="size-9 rounded-full text-sm" />
              <span className="font-semibold">{company.name}</span>
            </figcaption>
            <blockquote className="text-[15px] leading-relaxed whitespace-pre-line text-muted-foreground">{order.comment}</blockquote>
          </figure>
        </>
      )}

      <FloatingBar className="gap-3 pl-6">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{delivered ? "Заказ выдан" : "Есть вопрос по заказу?"}</p>
          <p className="truncate font-semibold">{delivered ? "Спасибо, что с нами" : "Ответим в чате"}</p>
        </div>
        <Button asChild size="lg">
          <Link href={`/c/${slug}/chat`}>
            <MessageCircle data-icon="inline-start" /> Написать
          </Link>
        </Button>
      </FloatingBar>
    </Screen>
  );
}

function Fact({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-card bg-card p-4">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 whitespace-pre-line">{children}</dd>
      </div>
    </div>
  );
}
