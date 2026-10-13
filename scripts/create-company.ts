// Creates the print shop and its owner account.
// Usage: npm run create-company -- --name "Типография «Оттиск»" --slug ottisk --email owner@ottisk.ru --password 'S3cure-pass' \
//          [--owner "Мария Петрова"] [--phone "+7 (495) 123-45-67"] [--address "Москва, ..."] [--hours "Пн–Пт 9:00–20:00"]
//          [--telegram ottisk_print]
//          [--color "#4f46e5"] [--timezone "Europe/Moscow"]
import { parseArgs } from "node:util";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_PRICE_LIST } from "../src/lib/pricing";

config({ path: ".env.local", quiet: true });

const { values: a } = parseArgs({
  options: {
    name: { type: "string" },
    slug: { type: "string" },
    email: { type: "string" },
    password: { type: "string" },
    owner: { type: "string", default: "Владелец" },
    phone: { type: "string" },
    address: { type: "string" },
    hours: { type: "string" },
    telegram: { type: "string" },
    color: { type: "string", default: "#1c1c1e" },
    timezone: { type: "string", default: "Europe/Moscow" },
  },
});

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (!a.name || !a.slug || !a.email || !a.password) fail("Нужны --name, --slug, --email и --password (см. README)");
if (!/^[a-z0-9-]+$/.test(a.slug)) fail("--slug: только латиница в нижнем регистре, цифры и дефис (например, ottisk)");
if (a.password.length < 8) fail("--password: не короче 8 символов");
if (!/^#[0-9a-fA-F]{6}$/.test(a.color!)) fail("--color: формат #RRGGBB");
const telegram = a.telegram?.replace(/^(https?:\/\/)?(t\.me|telegram\.me)\//i, "").replace(/^@/, "") || null;
if (telegram && !/^[A-Za-z0-9_]{5,32}$/.test(telegram)) fail("--telegram: имя из латиницы, цифр и _, от 5 до 32 символов");
if (!Intl.supportedValuesOf("timeZone").includes(a.timezone!)) fail(`--timezone: неизвестный часовой пояс ${a.timezone}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail("В .env.local нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: company, error } = await admin
    .from("companies")
    .insert({
      name: a.name,
      slug: a.slug,
      brand_color: a.color,
      phone: a.phone ?? null,
      email: a.email,
      address: a.address ?? null,
      work_hours: a.hours ?? null,
      telegram,
      timezone: a.timezone,
    })
    .select()
    .single();
  if (error) fail(error.code === "23505" ? `Адрес /c/${a.slug} уже занят` : error.message);

  const { data: user, error: userError } = await admin.auth.admin.createUser({
    email: a.email,
    password: a.password,
    email_confirm: true,
    user_metadata: { company_slug: a.slug, full_name: a.owner },
  });
  if (userError) {
    await admin.from("companies").delete().eq("id", company.id);
    fail(`Не удалось создать владельца: ${userError.message}`);
  }
  const { error: roleError } = await admin.from("profiles").update({ role: "owner" }).eq("id", user.user.id);
  if (roleError) fail(roleError.message);
  // Market prices so the calculator works right away; the owner adjusts them in the panel (/admin/prices)
  const { error: pricesError } = await admin.from("price_lists").insert({ company_id: company.id, config: DEFAULT_PRICE_LIST });
  if (pricesError) fail(pricesError.message);

  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  console.log(`✔ Создано: ${a.name}`);
  console.log(`  Приложение клиентов: ${site}/c/${a.slug}`);
  console.log(`  Панель сотрудников:  ${site}/admin  (вход: ${a.email})`);
  console.log(`  Калькулятор:         ${site}/c/${a.slug}/calculator  (цены — в панели, раздел «Цены»)`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
