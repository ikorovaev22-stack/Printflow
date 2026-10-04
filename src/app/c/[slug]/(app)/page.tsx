import Link from "next/link";
import { ArrowUpRight, CalendarDays, ChevronRight, Package, PackageCheck, Phone, Store, Truck } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { InstallBanner } from "@/components/client/install-banner";
import { Halftone } from "@/components/client/halftone";
import { OrderProgress } from "@/components/client/order-timeline";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Screen, SectionTitle } from "@/components/client/screen";
import { STATUS_ICONS, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { requireClient } from "@/lib/auth";
import { formatDateShort, greeting } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DELIVERY_LABELS, type Order } from "@/lib/types";

export const metadata = { title: "Мои заказы" };

export default async function OrdersScreen({ params, searchParams }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const { view } = (await searchParams) as { view?: string };
  const { supabase, profile, company } = await requireClient(slug);
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("client_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<Order[]>();
  const orders = data ?? [];
  const current = orders.filter((o) => o.status !== "delivered");
  const done = orders.filter((o) => o.status === "delivered");
  const archive = view === "done";

  const ready = current.filter((o) => o.status === "ready");
  const inWork = current.filter((o) => o.status !== "ready");
  const [featured, ...rest] = inWork;
  const firstName = profile.full_name.split(" ")[0];
  const phone = company.phone?.replace(/[^\d+]/g, "");

  return (
    <Screen
      leading={
        <Link href={`/c/${slug}/about`} className="flex min-w-0 items-center gap-3">
          <CompanyLogo company={company} className="size-12 rounded-full" />
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">Типография</span>
            <span className="block truncate font-semibold">{company.name}</span>
          </span>
        </Link>
      }
      action={
        phone && (
          <Button asChild variant="surface" size="icon-lg">
            <a href={`tel:${phone}`} aria-label="Позвонить в типографию">
              <Phone />
            </a>
          </Button>
        )
      }
      eyebrow={`${greeting(company.timezone)}${firstName ? `, ${firstName}` : ""}`}
      title="Ваши заказы"
    >
      <RealtimeRefresh table="orders" filter={`client_id=eq.${profile.id}`} />
      <InstallBanner />

      <nav aria-label="Фильтр заказов" className="mb-5 flex gap-2">
        <FilterChip href={`/c/${slug}`} active={!archive} label="Текущие" count={current.length} />
        <FilterChip href={`/c/${slug}?view=done`} active={archive} label="Выданные" count={done.length} />
      </nav>

      {!orders.length ? (
        <Empty className="mt-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Package />
            </EmptyMedia>
            <EmptyTitle>Заказов пока нет</EmptyTitle>
            <EmptyDescription>Когда типография оформит заказ, он появится здесь со статусом и сроком.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : archive ? (
        <OrderList slug={slug} orders={done} empty="Выданных заказов пока нет" />
      ) : (
        <>
          {!current.length && <p className="py-10 text-center text-muted-foreground">Все заказы выданы</p>}
          <div className="flex flex-col gap-3">
            {ready.map((o) => (
              <ReadyCard key={o.id} slug={slug} order={o} />
            ))}
            {featured && <FeaturedCard slug={slug} order={featured} />}
          </div>
          {!!rest.length && (
            <>
              <SectionTitle>Ещё в работе</SectionTitle>
              <OrderList slug={slug} orders={rest} />
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function FilterChip({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      replace
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span className={cn("text-xs tabular-nums", active ? "text-primary-foreground/60" : "text-muted-foreground/70")}>{count}</span>
    </Link>
  );
}

// The order the client cares about most: dark hero card, like a photo card with text over it
function FeaturedCard({ slug, order }: { slug: string; order: Order }) {
  const Delivery = order.delivery_method === "pickup" ? Store : Truck;
  return (
    <Link
      href={`/c/${slug}/orders/${order.id}`}
      className="group relative flex flex-col gap-6 overflow-hidden rounded-card bg-hero p-5 text-hero-foreground transition-transform active:scale-98 motion-reduce:active:scale-100"
    >
      <Halftone />
      <div className="relative flex items-start justify-between gap-3">
        <StatusBadge status={order.status} tone="glass" />
        <span className="flex size-11 items-center justify-center rounded-full bg-white text-hero transition-transform group-hover:rotate-45 motion-reduce:transition-none">
          <ArrowUpRight className="size-5" />
        </span>
      </div>
      <div className="relative">
        <p className="text-sm text-white/60">Заказ №{order.number}</p>
        <p className="mt-1 text-2xl leading-tight font-semibold tracking-tight">{order.title}</p>
      </div>
      <div className="relative flex flex-col gap-4">
        <OrderProgress status={order.status} tone="light" />
        <div className="flex flex-wrap gap-2">
          <GlassPill icon={CalendarDays}>{order.due_date ? `до ${formatDateShort(order.due_date)}` : "Срок уточняется"}</GlassPill>
          <GlassPill icon={Delivery}>{DELIVERY_LABELS[order.delivery_method]}</GlassPill>
        </div>
      </div>
    </Link>
  );
}

function ReadyCard({ slug, order }: { slug: string; order: Order }) {
  const pickup = order.delivery_method === "pickup";
  return (
    <Link
      href={`/c/${slug}/orders/${order.id}`}
      className="flex items-center gap-4 rounded-card bg-lime p-5 text-lime-foreground transition-transform active:scale-98 motion-reduce:active:scale-100"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-lime-foreground text-lime">
        <PackageCheck className="size-5.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium opacity-70">{pickup ? "Готов — можно забирать" : "Готов — скоро доставим"}</span>
        <span className="block truncate text-lg font-semibold">{order.title}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 opacity-60" />
    </Link>
  );
}

function OrderList({ slug, orders, empty }: { slug: string; orders: Order[]; empty?: string }) {
  if (!orders.length) return <p className="py-10 text-center text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {orders.map((o) => {
        const Icon = STATUS_ICONS[o.status];
        const delivered = o.status === "delivered";
        return (
          <li key={o.id}>
            <Link
              href={`/c/${slug}/orders/${o.id}`}
              className="flex items-center gap-4 rounded-card bg-card p-4 transition-transform active:scale-98 motion-reduce:active:scale-100"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-tile bg-muted">
                <Icon className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={cn("truncate font-semibold", delivered && "text-muted-foreground")}>{o.title}</span>
                <span className="text-sm text-muted-foreground">
                  №{o.number}
                  {o.due_date && !delivered && ` · до ${formatDateShort(o.due_date)}`}
                </span>
              </span>
              <StatusBadge status={o.status} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function GlassPill({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/12 px-3 text-sm backdrop-blur-md">
      <Icon className="size-4 opacity-70" />
      {children}
    </span>
  );
}
