export type Role = "client" | "staff" | "owner";
export type OrderStatus = "accepted" | "design" | "printing" | "finishing" | "ready" | "delivered";
export type DeliveryMethod = "pickup" | "delivery";

export type Company = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  brand_color: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  work_hours: string | null;
};

export type Profile = {
  id: string;
  company_id: string;
  role: Role;
  full_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
};

export type Order = {
  id: string;
  company_id: string;
  client_id: string;
  number: number;
  title: string;
  description: string | null;
  status: OrderStatus;
  due_date: string | null;
  delivery_method: DeliveryMethod;
  delivery_address: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  company_id: string;
  client_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type Faq = { id: string; company_id: string; question: string; answer: string; position: number };

export const STATUSES: { value: OrderStatus; label: string; className: string }[] = [
  { value: "accepted", label: "Принят", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  { value: "design", label: "Макет", className: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" },
  { value: "printing", label: "Печать", className: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" },
  { value: "finishing", label: "Постпечать", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  { value: "ready", label: "Готов", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  { value: "delivered", label: "Выдан", className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" },
];

export const statusMeta = (s: OrderStatus) => STATUSES.find((x) => x.value === s)!;

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = { pickup: "Самовывоз", delivery: "Доставка" };
