"use client";

import { useActionState, useState } from "react";
import { saveOrder } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useStatuses } from "@/components/statuses";
import type { Order, Profile } from "@/lib/types";

type Props = { order?: Order; clients: Pick<Profile, "id" | "full_name" | "email">[]; clientId?: string; back: string };

export function OrderForm({ order, clients, clientId, back }: Props) {
  const [state, action, pending] = useActionState(saveOrder, undefined);
  const [delivery, setDelivery] = useState(order?.delivery_method ?? "pickup");
  const statuses = useStatuses();

  return (
    <form action={action} className="grid gap-5 rounded-card bg-card p-6 md:grid-cols-2">
      {order && <input type="hidden" name="id" value={order.id} />}
      <input type="hidden" name="back" value={back} />
      <Field label="Клиент" className="md:col-span-2">
        <Select name="client_id" defaultValue={order?.client_id ?? clientId} required>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Выберите клиента" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.full_name || c.email} <span className="text-muted-foreground">{c.email}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Название" className="md:col-span-2">
        <Input name="title" defaultValue={order?.title} placeholder="Визитки 500 шт." maxLength={200} required />
      </Field>
      <Field label="Описание" className="md:col-span-2">
        <Textarea name="description" defaultValue={order?.description ?? ""} placeholder="Формат, бумага, тираж" rows={3} maxLength={4000} />
      </Field>
      <Field label="Статус">
        <Select name="status" defaultValue={order?.status ?? "accepted"}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Срок готовности">
        <Input name="due_date" type="date" defaultValue={order?.due_date ?? ""} />
      </Field>
      <Field label="Способ получения">
        <Select name="delivery_method" value={delivery} onValueChange={(v) => setDelivery(v as typeof delivery)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pickup">Самовывоз</SelectItem>
            <SelectItem value="delivery">Доставка</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Адрес доставки">
        <Input name="delivery_address" defaultValue={order?.delivery_address ?? ""} disabled={delivery !== "delivery"} maxLength={300} />
      </Field>
      <Field label="Стоимость, ₽">
        <Input name="price" type="number" inputMode="numeric" min={0} max={100000000} step={1} defaultValue={order?.price ?? ""} placeholder="Не указана" />
      </Field>
      <Field label="Комментарий для клиента" className="md:col-span-2">
        <Textarea name="comment" defaultValue={order?.comment ?? ""} rows={2} maxLength={2000} />
      </Field>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Сохранение…" : order ? "Сохранить" : "Создать заказ"}
        </Button>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
    </form>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
