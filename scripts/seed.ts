// Demo data for local development and tests: «Арт Проджект» with its real card (logo, colour, contacts, banners,
// FAQ) and fictional clients and orders. Re-running recreates it. Local Supabase only: on a live database it would
// wipe the print shop at the same address (artproject) with all its orders — SEED_REMOTE=1 overrides that
//   npm run seed   (or npm run dev:local -- --seed)
import { readFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_PRICE_LIST, quote, type CardsInput } from "../src/lib/pricing";

config({ path: ".env.local", quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url) && process.env.SEED_REMOTE !== "1") {
  console.error(
    `Сид пересоздаёт типографию «Арт Проджект» со всеми её заказами, а база ${url || "(не задана)"} не локальная — остановлено.\n` +
      "Локально: npm run dev:local -- --seed. Если это точно тестовая база: SEED_REMOTE=1 npm run seed",
  );
  process.exit(1);
}
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const ART = path.join(__dirname, "seed-assets");
const SLUG = "artproject";
const PASSWORD = "ArtProject2026!";

const users = [
  { email: "owner@artproject.demo", full_name: "Администратор", phone: null, role: "owner" },
  { email: "elena@artproject.demo", full_name: "Елена Соколова", phone: "+7 900 200-30-41", role: "client" },
  { email: "artem@artproject.demo", full_name: "Артём Ковалёв", phone: "+7 900 200-30-42", role: "client" },
  { email: "marina@artproject.demo", full_name: "Марина Лебедева", phone: "+7 900 200-30-43", role: "client" },
] as const;

const banners = [
  ["01-urgent", "Срочная печать — запуск в день обращения"],
  ["02-cards", "Дизайнерские визитки: Soft Touch, тиснение серебром и золотом"],
  ["03-flyers", "Дешёвые листовки сборными тиражами от 1000 шт."],
  ["04-certificates", "Печать сертификатов А4 и А3 по вашему макету"],
  ["05-tags-logo", "Бирки с логотипом под клиента от 500 шт."],
  ["06-tags-marketplaces", "Бирки для одежды и маркетплейсов от 500 шт."],
  ["07-runs", "Сборные тиражи или индивидуальная печать"],
  ["08-services", "Услуги типографии"],
];

const faqs = [
  [
    "Какие услуги вы оказываете?",
    `• Печать проектной документации, копирование, сканирование документов.
• Изготовление и печать визиток, брошюр, буклетов, листовок и прочих полиграфических изданий.
• Изготовление и печать баннеров, бордов, ресторанных меню, блокнотов, авторефератов.
• Офсетные тиражи в ч/б и цветном формате.
• Печать форматов А1, А2, А3, А4, А5, А6 в цветном и чёрно-белом варианте.
• Сертификаты А4 и А3: золото и серебро, рельефное тиснение.
• Бирки с логотипом для одежды и маркетплейсов, с резинками или люверсами.

Цены ниже рыночных.`,
  ],
  [
    "Можно сделать заказ срочно?",
    "Да. Срочная печать — запуск в день обращения. Цифровая печать — от 1 дня, офсет — сборными тиражами. Сроки фиксируем и не переносим.",
  ],
  [
    "Какие минимальные тиражи?",
    `• Листовки офсетом (сборные тиражи) — от 1000 шт.
• Бирки с логотипом — от 500 шт.
• Сертификаты А4 и А3 — от 10 шт.

Нужен другой тираж — напишите в чат, подберём вариант.`,
  ],
  [
    "Когда вы работаете?",
    `Пн–пт 12:00–20:00, сб 12:00–18:00.
Приём заказов — с 11:00 до 20:00.

Адрес: г. Краснодар, ул. Карякина, 25 (1 цоколь).`,
  ],
  [
    "Какие требования к макету?",
    `Для быстрой и качественной печати проверьте макет по чек-листу:

• Формат: PDF (строго версия 1.3) или TIFF. Без скрытых слоёв (сведены). Для PDF — только ZIP-сжатие.
• Цвет: только CMYK (без Pantone). Встраивать ICC-профили нельзя. Лимит краски (TIL) — не более 300%.
• Качество фото (растр): строго от 290 до 605 dpi.
• Шрифты (текст): обязательно переведены в кривые, чтобы шрифты не заменились при печати.`,
  ],
  [
    "Какого размера делать макет?",
    `На примере визитки 90×50 мм:

• Размер в файле — 92×52 мм. Масштаб 1:1, но с вылетами: добавлено по 1 мм фона с каждой стороны (запас под обрезку).
• Безопасная зона — 88×48 мм. Важный текст и логотипы отодвиньте на 2 мм от краёв готового изделия, чтобы их не срезал нож.`,
  ],
  [
    "Почему нельзя перевести фотографию в кривые?",
    `Фотография — это миллионы пикселей и плавные переходы света. Вектор (кривые) работает только с чёткими контурами. Если перевести фото в вектор, оно потеряет реалистичность и превратится в набор грубых цветных пятен.

Итог: фотографии всегда оставляем в растре (290–605 dpi), а в кривые переводим только тексты, чертежи и логотипы.`,
  ],
  [
    "Можно просто сохранить картинку в PDF?",
    "Это не улучшит качество. Делайте PDF из картинки только в нужном размере, а лучше — воспользуйтесь услугами дизайнера или специальными программами, где можно сделать макет, полностью соответствующий требованиям для печати (размер, разрешение, зазоры и т. п.).",
  ],
  [
    "Что значат растр, кривые, вылеты, DPI и CMYK?",
    `Растр — фотографии и картинки, состоящие из пикселей (точек).
Кривые (вектор) — формы и линии (текст, логотипы). Не теряют чёткости при увеличении.
Вылеты — запас фона по краям макета (+1 мм), который срежется ножом.
DPI — разрешение, или качество картинки (точек на дюйм).
CMYK — цветовая модель для печатных машин (в отличие от RGB для мониторов).`,
  ],
  [
    "Как с вами связаться?",
    `Телефон и MAX: +7 (938) 455-55-10
Телефон: +7 (918) 658-70-00
Telegram: @ArtProject23
Почта: a0-a8@yandex.ru

Напишите нам прямо сейчас и получите лучшее предложение!`,
  ],
];

const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

function must<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

async function main() {
  // Previous run: accounts, company (rows cascade), logo and banner images
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of list?.users ?? []) if (users.some((x) => x.email === u.email)) await admin.auth.admin.deleteUser(u.id);
  const { data: old } = await admin.from("companies").select("id").eq("slug", SLUG).maybeSingle();
  if (old) {
    for (const bucket of ["logos", "banners"]) {
      const { data: files } = await admin.storage.from(bucket).list(old.id);
      if (files?.length) await admin.storage.from(bucket).remove(files.map((f) => `${old.id}/${f.name}`));
    }
    must(await admin.from("companies").delete().eq("id", old.id));
  }

  const company = must(
    await admin
      .from("companies")
      .insert({
        name: "Арт Проджект",
        slug: SLUG,
        brand_color: "#3b3187",
        phone: "+7 (938) 455-55-10",
        email: "a0-a8@yandex.ru",
        address: "Краснодар, ул. Карякина, 25 (1 цоколь)",
        work_hours: "Пн–Пт 12:00–20:00, Сб 12:00–18:00. Приём заказов: 11:00–20:00",
        telegram: "ArtProject23",
        max_url: "https://max.ru/u/f9LHodD0cOIdsNKfJXDsl-jUedYF9s5sYeAht141z66irDUfeacPAs12CDw",
        max_phone: "+7 (938) 455-55-10",
        finishing_stage: false,
        timezone: "Europe/Moscow",
      })
      .select()
      .single(),
  );

  const logoPath = `${company.id}/logo-${Date.now()}.png`;
  must(await admin.storage.from("logos").upload(logoPath, readFileSync(path.join(ART, "logo.png")), { contentType: "image/png" }));
  const logoUrl = admin.storage.from("logos").getPublicUrl(logoPath).data.publicUrl;
  must(await admin.from("companies").update({ logo_url: logoUrl }).eq("id", company.id));

  for (const [i, [file, title]] of banners.entries()) {
    const bannerPath = `${company.id}/banner-${i + 1}.jpg`;
    must(await admin.storage.from("banners").upload(bannerPath, readFileSync(path.join(ART, `${file}.jpg`)), { contentType: "image/jpeg" }));
    must(await admin.from("banners").insert({ company_id: company.id, path: bannerPath, title, position: i }));
  }

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
  const [elena, artem, marina] = ["elena", "artem", "marina"].map((n) => ids[`${n}@artproject.demo`]);
  const owner = ids["owner@artproject.demo"];

  const orders = [
    { client_id: elena, title: "Визитки Soft Touch с тиснением, 1000 шт.", status: "printing", due_date: day(2), delivery_method: "pickup" },
    { client_id: elena, title: "Листовки А5, 2000 шт.", status: "delivered", due_date: day(-12), delivery_method: "pickup" },
    { client_id: artem, title: "Бирки с логотипом, 500 шт.", status: "design", due_date: day(5), delivery_method: "pickup", comment: "Ждём согласования макета" },
    { client_id: artem, title: "Меню для ресторана, 15 шт.", status: "ready", due_date: day(0), delivery_method: "delivery", delivery_address: "Краснодар, ул. Северная, 310", comment: "Доставим сегодня после 17:00" },
    { client_id: marina, title: "Сертификаты А4 с золотым тиснением, 30 шт.", status: "printing", due_date: day(1), delivery_method: "pickup" },
    { client_id: marina, title: "Проектная документация А1, 24 листа", status: "ready", due_date: day(0), delivery_method: "pickup", comment: "Можно забирать до 20:00" },
    { client_id: marina, title: "Автореферат, 100 экз.", status: "accepted", due_date: day(4), delivery_method: "pickup" },
    { client_id: elena, title: "Блокноты А5 с логотипом, 50 шт.", status: "delivered", due_date: day(-25), delivery_method: "pickup" },
  ];
  // Without "Постпечать": the stage is switched off for this print shop
  const STEPS = ["accepted", "design", "printing", "ready", "delivered"];
  for (const o of orders) {
    const order = must(await admin.from("orders").insert({ ...o, company_id: company.id }).select("id").single())!;
    // Plausible history instead of the single trigger-written event, one step per working day
    must(await admin.from("order_events").delete().eq("order_id", order.id));
    const last = STEPS.indexOf(o.status);
    const history = STEPS.slice(0, last + 1).map((status, i) => ({
      order_id: order.id,
      company_id: company.id,
      status,
      created_at: new Date(Date.now() - (last - i) * 86400000 - (i === last ? 2 : 9) * 3600000).toISOString(),
    }));
    must(await admin.from("order_events").insert(history));
  }

  // Calculator: market prices to start with (the owner sets their own in /admin/prices) and one client request
  must(await admin.from("price_lists").insert({ company_id: company.id, config: DEFAULT_PRICE_LIST }));
  const request: CardsInput = {
    product: "cards", size: "90x50", qty: 500, paper: "designer", sides: "4+4", lamination: "none", corners: true, urgent: true,
  };
  const q = quote(request, DEFAULT_PRICE_LIST);
  must(
    await admin.from("orders").insert({
      company_id: company.id,
      client_id: artem,
      title: q.title,
      description: "Нужны к понедельнику",
      source: "calculator",
      calc: { input: request, lines: q.lines, total: q.total, price_list_updated_at: new Date().toISOString() },
      price: q.total,
    }),
  );

  for (const [i, [question, answer]] of faqs.entries())
    must(await admin.from("faqs").insert({ company_id: company.id, question, answer, position: i }));

  const now = Date.now();
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60000).toISOString();
  const messages = [
    { client_id: artem, sender_id: artem, body: "Здравствуйте! Можно на бирки добавить люверсы?", read_at: at(50), created_at: at(55) },
    { client_id: artem, sender_id: owner, body: "Добрый день, Артём! Да, добавим. Макет с люверсами пришлём на согласование сегодня.", read_at: at(40), created_at: at(48) },
    { client_id: elena, sender_id: elena, body: "Визитки успеете к концу недели?", read_at: at(20), created_at: at(25) },
    { client_id: elena, sender_id: owner, body: "Елена, да — они уже в печати, будут готовы послезавтра.", created_at: at(18) },
    { client_id: marina, sender_id: marina, body: "Добрый день! Документацию заберу сегодня в 18:00.", created_at: at(6) },
  ];
  for (const m of messages) must(await admin.from("messages").insert({ ...m, company_id: company.id }));

  console.log(`✔ «${company.name}»: /c/${SLUG}, ${banners.length} баннеров, ${orders.length + 1} заказов, ${faqs.length} вопросов`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
