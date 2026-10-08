import "server-only";
import nodemailer from "nodemailer";
import webpush from "web-push";
import { SITE_URL } from "@/lib/config";
import { formatRub } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { statusMeta, type Message, type OrderCalc, type OrderStatus } from "@/lib/types";

// Delivery is best-effort and runs after the response (next/server `after`): failures are logged, never thrown.
// Every channel is optional: push needs VAPID keys + service role, email needs SMTP_HOST.

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const pushEnabled = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
if (pushEnabled) webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", VAPID_PUBLIC!, VAPID_PRIVATE!);

const smtpPort = Number(process.env.SMTP_PORT || 465);
const mailer = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

type Push = { title: string; body: string; url: string; tag: string; icon?: string };
const icon = (slug: string) => `/c/${slug}/app-icon/192`;
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

async function push(admin: Admin, userIds: string[], payload: Push) {
  if (!pushEnabled || !userIds.length) return;
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", userIds);
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          TTL: 60 * 60 * 24,
        });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // The browser dropped the subscription
        if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("push failed", code ?? e);
      }
    }),
  );
}

async function email(to: string | null | undefined, from: string, subject: string, text: string) {
  if (!mailer || !to) return;
  try {
    await mailer.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER || from, to, subject, text });
  } catch (e) {
    console.error("email failed", e);
  }
}

async function loadOrder(admin: Admin, orderId: string) {
  const { data } = await admin
    .from("orders")
    .select("id, number, title, status, client_id, company_id, company:companies(name, slug), client:profiles(full_name, email)")
    .eq("id", orderId)
    .single<{
      id: string;
      number: number;
      title: string;
      status: OrderStatus;
      client_id: string;
      company_id: string;
      company: { name: string; slug: string };
      client: { full_name: string; email: string | null };
    }>();
  return data;
}

async function staffIds(admin: Admin, companyId: string) {
  const { data } = await admin.from("profiles").select("id").eq("company_id", companyId).in("role", ["staff", "owner"]);
  return (data ?? []).map((p) => p.id);
}

const link = (path: string) => `${SITE_URL}${path}`;
const short = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// New order or status change: tell the client (push + email)
export async function notifyOrder(orderId: string, kind: "created" | "status") {
  const admin = createAdminClient();
  if (!admin) return;
  const o = await loadOrder(admin, orderId);
  if (!o) return;
  const status = statusMeta(o.status).label;
  const path = `/c/${o.company.slug}/orders/${o.id}`;
  const body = kind === "created" ? `Новый заказ №${o.number} «${o.title}» — ${status}` : `Заказ №${o.number} «${o.title}»: ${status}`;
  await Promise.all([
    push(admin, [o.client_id], { title: o.company.name, body, url: path, tag: `order-${o.id}`, icon: icon(o.company.slug) }),
    email(
      o.client.email,
      o.company.name,
      kind === "created" ? `Новый заказ №${o.number}` : `Заказ №${o.number}: ${status}`,
      `Здравствуйте${o.client.full_name ? `, ${o.client.full_name}` : ""}!\n\n${body}.\n${
        o.status === "ready" ? "Заказ готов — можно забирать.\n" : ""
      }\nПодробности: ${link(path)}\n\n${o.company.name}`,
    ),
  ]);
}

// Chat: client → all staff of the company; staff → the client
export async function notifyMessage(m: Pick<Message, "client_id" | "company_id" | "from_client" | "body">) {
  const admin = createAdminClient();
  if (!admin) return;
  const [{ data: company }, { data: client }] = await Promise.all([
    admin.from("companies").select("name, slug").eq("id", m.company_id).single(),
    admin.from("profiles").select("full_name, email").eq("id", m.client_id).single(),
  ]);
  if (!company || !client) return;
  if (m.from_client) {
    await push(admin, await staffIds(admin, m.company_id), {
      title: client.full_name || client.email || "Клиент",
      body: short(m.body),
      url: `/admin/chat/${m.client_id}`,
      tag: `chat-${m.client_id}`,
      icon: icon(company.slug),
    });
  } else {
    await push(admin, [m.client_id], { title: company.name, body: short(m.body), url: `/c/${company.slug}/chat`, tag: "chat", icon: icon(company.slug) });
  }
}

// File on an order: client upload → staff; print shop upload (proof) → client (push + email)
export async function notifyFileUploaded(orderId: string, name: string, fromClient: boolean) {
  const admin = createAdminClient();
  if (!admin) return;
  const o = await loadOrder(admin, orderId);
  if (!o) return;
  if (fromClient) {
    await push(admin, await staffIds(admin, o.company_id), {
      title: `Файл к заказу №${o.number}`,
      body: `${o.client.full_name || "Клиент"}: ${short(name, 80)}`,
      url: `/admin/orders/${o.id}`,
      tag: `files-${o.id}`,
      icon: icon(o.company.slug),
    });
    return;
  }
  const path = `/c/${o.company.slug}/orders/${o.id}`;
  const body = `К заказу №${o.number} «${o.title}» добавлен файл: ${short(name, 80)}`;
  await Promise.all([
    push(admin, [o.client_id], { title: o.company.name, body, url: path, tag: `files-${o.id}`, icon: icon(o.company.slug) }),
    email(o.client.email, o.company.name, `Файл к заказу №${o.number}`, `${body}.\n\nОткрыть заказ: ${link(path)}\n\n${o.company.name}`),
  ]);
}

// Calculator request from a client: all staff get a push, the print shop's mailbox gets the full calculation
export async function notifyOrderRequest(orderId: string) {
  const admin = createAdminClient();
  if (!admin) return;
  const { data: o } = await admin
    .from("orders")
    .select("id, number, title, description, price, calc, company_id, company:companies(name, slug, email), client:profiles(full_name, email, phone)")
    .eq("id", orderId)
    .single<{
      id: string;
      number: number;
      title: string;
      description: string | null;
      price: number | null;
      calc: OrderCalc | null;
      company_id: string;
      company: { name: string; slug: string; email: string | null };
      client: { full_name: string; email: string | null; phone: string | null };
    }>();
  if (!o) return;
  const client = o.client.full_name || o.client.email || "Клиент";
  const price = o.price === null ? "" : ` — ${formatRub(o.price)}`;
  const path = `/admin/orders/${o.id}`;
  const lines = (o.calc?.lines ?? []).map((l) => `  ${l.label} — ${formatRub(l.amount)}`).join("\n");
  await Promise.all([
    push(admin, await staffIds(admin, o.company_id), {
      title: `Новая заявка №${o.number}`,
      body: short(`${client}: ${o.title}${price}`),
      url: path,
      tag: `request-${o.id}`,
      icon: icon(o.company.slug),
    }),
    email(
      o.company.email,
      o.company.name,
      `Новая заявка №${o.number}: ${o.title}`,
      [
        `Заявка из калькулятора №${o.number}: ${o.title}`,
        `Клиент: ${client}${o.client.phone ? `, ${o.client.phone}` : ""}${o.client.email ? `, ${o.client.email}` : ""}`,
        "",
        lines,
        `Итого (предварительно): ${o.price === null ? "—" : formatRub(o.price)}`,
        o.description ? `\nКомментарий клиента: ${o.description}` : "",
        `\nОткрыть заявку: ${link(path)}`,
      ].join("\n"),
    ),
  ]);
}
