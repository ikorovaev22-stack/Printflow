import type { AiMode, DraftKind } from "@/lib/assistant";
import type { CalcInput, QuoteLine } from "@/lib/pricing";

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
  telegram: string | null;
  max_url: string | null;
  max_phone: string | null;
  finishing_stage: boolean;
  timezone: string;
};

export type Profile = {
  id: string;
  company_id: string;
  role: Role;
  full_name: string;
  phone: string | null;
  email: string | null;
  pd_consent_at: string | null;
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
  source: "staff" | "calculator";
  calc: OrderCalc | null;
  price: number | null;
  created_at: string;
  updated_at: string;
};

// The client's calculation behind a calculator request, as the server recalculated it
export type OrderCalc = { input: CalcInput; lines: QuoteLine[]; total: number; price_list_updated_at: string };

export type Message = {
  id: string;
  company_id: string;
  client_id: string;
  // null for the assistant's own messages (ai)
  sender_id: string | null;
  body: string;
  read_at: string | null;
  from_client: boolean;
  ai: boolean;
  created_at: string;
};

// A chat with no row is active and was never completed
export type ChatState = { client_id: string; closed_at: string | null; closed_count: number };

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

export type Banner = { id: string; company_id: string; path: string; title: string | null; position: number };

export type Faq = { id: string; company_id: string; question: string; answer: string; position: number };

export type Post = { id: string; company_id: string; title: string; body: string; created_at: string };

export type AiSettings = { company_id: string; mode: AiMode; handoff_text: string | null };
export type AiKnowledge = {
  id: string;
  company_id: string;
  title: string;
  body: string;
  url: string | null;
  fetched_at: string | null;
  enabled: boolean;
  created_at: string;
};
export type AiTemplate = { id: string; company_id: string; question: string; answer: string; position: number };
// reply: an answer to a chat message, or a handoff to a manager (no body); post: news; faq: question (title) and answer
export type AiDraft = {
  id: string;
  company_id: string;
  kind: DraftKind;
  status: "pending" | "published" | "dismissed";
  client_id: string | null;
  message_id: string | null;
  title: string | null;
  body: string | null;
  handoff: boolean;
  note: string | null;
  created_at: string;
};

export const STATUSES: { value: OrderStatus; label: string; dot: string }[] = [
  { value: "accepted", label: "Принят", dot: "bg-zinc-400" },
  { value: "design", label: "Макет", dot: "bg-violet-500" },
  { value: "printing", label: "Печать", dot: "bg-sky-500" },
  { value: "finishing", label: "Постпечать", dot: "bg-amber-500" },
  { value: "ready", label: "Готов", dot: "bg-lime-500" },
  { value: "delivered", label: "Выдан", dot: "bg-zinc-300" },
];

export const statusMeta = (s: OrderStatus) => STATUSES.find((x) => x.value === s)!;

// The stages a company uses: "Постпечать" can be switched off in the settings
export const companyStatuses = (company: Pick<Company, "finishing_stage">) =>
  STATUSES.filter((s) => s.value !== "finishing" || company.finishing_stage);

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = { pickup: "Самовывоз", delivery: "Доставка" };
