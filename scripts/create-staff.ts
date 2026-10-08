// Adds a manager (or another owner) to an existing print shop.
// Usage: npm run create-staff -- --slug ottisk --email manager@ottisk.ru --password 'S3cure-pass' --name "Ольга Иванова" \
//          [--phone "+7 900 000-00-00"] [--role staff|owner]
import { parseArgs } from "node:util";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

const { values: a } = parseArgs({
  options: {
    slug: { type: "string" },
    email: { type: "string" },
    password: { type: "string" },
    name: { type: "string" },
    phone: { type: "string" },
    role: { type: "string", default: "staff" },
  },
});

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (!a.slug || !a.email || !a.password || !a.name) fail("Нужны --slug, --email, --password и --name (см. README)");
if (a.password.length < 8) fail("--password: не короче 8 символов");
if (a.role !== "staff" && a.role !== "owner") fail("--role: staff (сотрудник) или owner (владелец)");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) fail("В .env.local нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: company } = await admin.from("companies").select("name").eq("slug", a.slug!).maybeSingle();
  if (!company) fail(`Типография /c/${a.slug} не найдена`);

  // The sign-up trigger creates the profile as a client of this company; the role is raised right after
  const { data: user, error } = await admin.auth.admin.createUser({
    email: a.email,
    password: a.password,
    email_confirm: true,
    user_metadata: { company_slug: a.slug, full_name: a.name, phone: a.phone },
  });
  if (error) fail(error.code === "email_exists" ? `${a.email} уже зарегистрирован` : error.message);
  const { error: roleError } = await admin.from("profiles").update({ role: a.role }).eq("id", user.user.id);
  if (roleError) {
    await admin.auth.admin.deleteUser(user.user.id);
    fail(roleError.message);
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  console.log(`✔ ${a.role === "owner" ? "Владелец" : "Сотрудник"} ${a.name} добавлен в «${company.name}»`);
  console.log(`  Вход в панель: ${site}/admin  (${a.email})`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
