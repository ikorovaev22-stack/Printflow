import Link from "next/link";
import { DueDatePicker, StatusSelect } from "@/components/admin/order-quick-edit";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DELIVERY_LABELS, type Order } from "@/lib/types";

export type OrderRow = Order & { client: { id: string; full_name: string; email: string | null } | null };

export function OrdersTable({ orders, showClient = true }: { orders: OrderRow[]; showClient?: boolean }) {
  if (!orders.length) {
    return <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">Заказов не найдено</div>;
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 pl-4">№</TableHead>
            <TableHead>Заказ</TableHead>
            {showClient && <TableHead>Клиент</TableHead>}
            <TableHead>Статус</TableHead>
            <TableHead>Срок</TableHead>
            <TableHead>Получение</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="pl-4 font-mono text-muted-foreground">{o.number}</TableCell>
              <TableCell>
                <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                  {o.title}
                </Link>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
