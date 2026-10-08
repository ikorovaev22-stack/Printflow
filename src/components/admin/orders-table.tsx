import Link from "next/link";
import { Package } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { DueDatePicker, StatusSelect } from "@/components/admin/order-quick-edit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRub } from "@/lib/format";
import { DELIVERY_LABELS, type Order } from "@/lib/types";

export type OrderRow = Order & { client: { id: string; full_name: string; email: string | null } | null };

export function OrdersTable({ orders, showClient = true }: { orders: OrderRow[]; showClient?: boolean }) {
  if (!orders.length) {
    return (
      <Empty className="border-2">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Package />
          </EmptyMedia>
          <EmptyTitle>Заказов не найдено</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="overflow-hidden rounded-card bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 pl-5">№</TableHead>
            <TableHead>Заказ</TableHead>
            {showClient && <TableHead>Клиент</TableHead>}
            <TableHead>Статус</TableHead>
            <TableHead>Срок</TableHead>
            <TableHead>Получение</TableHead>
            <TableHead className="pr-5 text-right">Сумма</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="pl-5 text-muted-foreground">{o.number}</TableCell>
              <TableCell>
                <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                  {o.title}
                </Link>
                {o.source === "calculator" && (
                  <span className="ml-2 inline-flex h-6 items-center rounded-full bg-muted px-2.5 align-middle text-xs font-medium">Заявка</span>
                )}
              </TableCell>
              {showClient && (
                <TableCell>
                  {o.client && (
                    <Link href={`/admin/clients/${o.client.id}`} className="text-muted-foreground hover:text-foreground">
                      {o.client.full_name || o.client.email}
                    </Link>
                  )}
                </TableCell>
              )}
              <TableCell>
                <StatusSelect id={o.id} status={o.status} />
              </TableCell>
              <TableCell>
                <DueDatePicker id={o.id} due={o.due_date} status={o.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">{DELIVERY_LABELS[o.delivery_method]}</TableCell>
              <TableCell className="pr-5 text-right tabular-nums">{o.price === null ? "—" : formatRub(o.price)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
