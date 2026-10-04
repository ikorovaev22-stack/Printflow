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
  timezone: string;
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
  from_client: boolean;
  created_at: string;
};

export type OrderEvent = { status: OrderStatus; created_at: string };

export type OrderFile = {
  id: string;
  order_id: string;
  uploaded_by: string;
  from_client: boolean;
  name: string;
  path: string;
  size: number;
  mime: string | null;
  created_at: string;
};

export type Faq = { id: string; company_id: string; question: string; answer: string; position: number };

export const STATUSES: { value: OrderStatus; label: string; dot: string }[] = [
  { value: "accepted", label: "Принят", dot: "bg-zinc-400" },
  { value: "design", label: "Макет", dot: "bg-violet-500" },
  { value: "printing", label: "Печать", dot: "bg-sky-500" },
  { value: "finishing", label: "Постпечать", dot: "bg-amber-500" },
  { value: "ready", label: "Готов", dot: "bg-lime-500" },
  { value: "delivered", label: "Выдан", dot: "bg-zinc-300" },
];

export const statusMeta = (s: OrderStatus) => STATUSES.find((x) => x.value === s)!;

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = { pickup: "Самовывоз", delivery: "Доставка" };
