import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const SLUG = "demo";
const PASSWORD = "Demo1234!";

const users = [
  { email: "owner@printflow.demo", full_name: "Мария Петрова", phone: "+7 900 000-00-01", role: "owner" },
  { email: "anna@printflow.demo", full_name: "Анна Смирнова", phone: "+7 900 000-00-11", role: "client" },
  { email: "ivan@printflow.demo", full_name: "Иван Кузнецов", phone: "+7 900 000-00-12", role: "client" },
  { email: "olga@printflow.demo", full_name: "Ольга Волкова", phone: "+7 900 000-00-13", role: "client" },
] as const;

const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

function must<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

async function main() {
  // Clean up previous run
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of list?.users ?? []) {
    if (users.some((x) => x.email === u.email)) await admin.auth.admin.deleteUser(u.id);
  }
  const { data: old } = await admin.from("companies").select("id").eq("slug", SLUG).maybeSingle();
  if (old) {
    const { data: files } = await admin.storage.from("logos").list(old.id);
    if (files?.length) await admin.storage.from("logos").remove(files.map((f) => `${old.id}/${f.name}`));
  }
  must(await admin.from("companies").delete().eq("slug", SLUG));

  const company = must(
    await admin
      .from("companies")
      .insert({
        name: "Типография «Оттиск»",
        slug: SLUG,
        brand_color: "#4f46e5",
        phone: "+7 (495) 123-45-67",
        email: "hello@ottisk.demo",
        address: "Москва, ул. Полиграфическая, 12",
        work_hours: "Пн–Пт 9:00–20:00, Сб 10:00–16:00",
      })
      .select()
      .single(),
  );

  const ids: Record<string, string> = {};
  for (const u of users) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { company_slug: SLUG, full_name: u.full_name, phone: u.phone },
    });
    if (error) throw error;
    ids[u.email] = created.user.id;
    if (u.role !== "client") must(await admin.from("profiles").update({ role: u.role }).eq("id", created.user.id));
  }

  const [anna, ivan, olga] = ["anna", "ivan", "olga"].map((n) => ids[`${n}@printflow.demo`]);
  const orders = [
    { client_id: anna, title: "Визитки 500 шт.", status: "delivered", due_date: day(-10), delivery_method: "pickup" },
    { client_id: anna, title: "Листовки А5, 2000 шт.", status: "ready", due_date: day(0), delivery_method: "pickup", comment: "Можно забирать, оплата при получении" },
    { client_id: anna, title: "Каталог продукции, 40 стр.", status: "printing", due_date: day(3), delivery_method: "delivery", delivery_address: "Москва, Тверская ул., 7, офис 12" },
    { client_id: ivan, title: "Баннер 3×1 м", status: "design", due_date: day(4), delivery_method: "pickup", comment: "Ждём согласования макета" },
    { client_id: ivan, title: "Наклейки с логотипом, 300 шт.", status: "finishing", due_date: day(1), delivery_method: "pickup" },
    { client_id: ivan, title: "Меню для кафе, 20 шт.", status: "accepted", due_date: day(6), delivery_method: "delivery", delivery_address: "Москва, Арбат, 25" },
    { client_id: olga, title: "Свадебные приглашения, 80 шт.", status: "design", due_date: day(7), delivery_method: "pickup" },
    { client_id: olga, title: "Фотокнига 30×30", status: "printing", due_date: day(2), delivery_method: "pickup" },
    { client_id: olga, title: "Календари настенные, 50 шт.", status: "ready", due_date: day(-1), delivery_method: "delivery", delivery_address: "Москва, Ленинский пр-т, 45" },
    { client_id: olga, title: "Бланки А4, 1000 шт.", status: "delivered", due_date: day(-20), delivery_method: "pickup" },
  ];
  for (const o of orders) must(await admin.from("orders").insert({ ...o, company_id: company.id }));

  const faqs = [
    ["Сколько времени занимает печать?", "Визитки и листовки — 1–2 рабочих дня. Каталоги, книги и широкоформатная печать — 3–5 дней. Точный срок указан в карточке заказа."],
    ["Как узнать, что заказ готов?", "Статус заказа обновляется в приложении. Когда он сменится на «Готов», заказ можно забирать."],
    ["Можно ли заказать доставку?", "Да, доставляем по Москве в пределах МКАД. Адрес доставки указывается в заказе."],
    ["В каком формате присылать макет?", "PDF с вылетами 2 мм, цвета в CMYK, шрифты в кривых. Если макета нет — наши дизайнеры помогут."],
    ["Как оплатить заказ?", "Наличными или картой при получении, либо по счёту для юрлиц."],
  ];
  for (const [i, [question, answer]] of faqs.entries())
    must(await admin.from("faqs").insert({ company_id: company.id, question, answer, position: i }));

  const owner = ids["owner@printflow.demo"];
  const messages = [
    { client_id: anna, sender_id: anna, body: "Здравствуйте! Листовки уже готовы?", read_at: new Date().toISOString() },
    { client_id: anna, sender_id: owner, body: "Добрый день, Анна! Да, можно забирать сегодня до 20:00." },
    { client_id: ivan, sender_id: ivan, body: "Когда пришлёте макет баннера на согласование?" },
  ];
  for (const m of messages) must(await admin.from("messages").insert({ ...m, company_id: company.id }));

  console.log(`Seeded company "${company.name}" (/c/${SLUG}), ${users.length} users, ${orders.length} orders`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
