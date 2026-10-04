import { config } from "dotenv";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);

const PASSWORD = "RlsTest123!";
const run = Date.now();
type Ctx = { companyId: string; clientId: string; staffId: string; orderId: string; messageId: string; faqId: string };
const ctx: Record<"A" | "B", Ctx> = {} as never;
const userIds: string[] = [];
let clientA: SupabaseClient, staffA: SupabaseClient, anon: SupabaseClient;

async function createUser(slug: string, name: string, role: "client" | "staff") {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${name}-${run}@rls.test`,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { company_slug: slug, full_name: name },
  });
  if (error) throw error;
  userIds.push(data.user.id);
  if (role === "staff") await admin.from("profiles").update({ role: "staff" }).eq("id", data.user.id);
  return data.user.id;
}

async function setupCompany(key: "A" | "B") {
  const slug = `rls-${key.toLowerCase()}-${run}`;
  const { data: c, error } = await admin.from("companies").insert({ name: `RLS ${key}`, slug }).select().single();
  if (error) throw error;
  const clientId = await createUser(slug, `client${key}`, "client");
  const staffId = await createUser(slug, `staff${key}`, "staff");
  const { data: o } = await admin.from("orders").insert({ company_id: c.id, client_id: clientId, title: `Order ${key}` }).select().single();
  const { data: m } = await admin.from("messages").insert({ company_id: c.id, client_id: clientId, sender_id: clientId, body: `Hi ${key}` }).select().single();
  const { data: f } = await admin.from("faqs").insert({ company_id: c.id, question: "Q", answer: "A" }).select().single();
  ctx[key] = { companyId: c.id, clientId, staffId, orderId: o!.id, messageId: m!.id, faqId: f!.id };
}

async function signIn(name: string) {
  const sb = createClient(URL, ANON, opts);
  const { error } = await sb.auth.signInWithPassword({ email: `${name}-${run}@rls.test`, password: PASSWORD });
  if (error) throw error;
  return sb;
}

before(async () => {
  await setupCompany("A");
  await setupCompany("B");
  // second client in A to check client-to-client isolation
  const otherId = await createUser(`rls-a-${run}`, "clientA2", "client");
  await admin.from("orders").insert({ company_id: ctx.A.companyId, client_id: otherId, title: "Other client order" });
  clientA = await signIn("clientA");
  staffA = await signIn("staffA");
  anon = createClient(URL, ANON, opts);
});

after(async () => {
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
  await admin.from("companies").delete().in("id", [ctx.A?.companyId, ctx.B?.companyId].filter(Boolean));
});

describe("RLS: company isolation", () => {
  for (const who of ["client", "staff"] as const) {
    test(`${who} A cannot read company B data`, async () => {
      const sb = who === "client" ? clientA : staffA;
      for (const table of ["orders", "messages", "profiles"]) {
        const { data, error } = await sb.from(table).select("id").eq("company_id", ctx.B.companyId);
        assert.equal(error, null);
        assert.equal(data!.length, 0, `${who} A sees ${table} of B`);
      }
    });

    test(`${who} A cannot write company B data`, async () => {
      const sb = who === "client" ? clientA : staffA;
      const ins = await sb.from("orders").insert({ company_id: ctx.B.companyId, client_id: ctx.B.clientId, title: "hack" });
      assert.notEqual(ins.error, null);
      const upd = await sb.from("orders").update({ title: "hacked" }).eq("id", ctx.B.orderId).select();
      assert.equal(upd.data?.length ?? 0, 0);
      const del = await sb.from("faqs").delete().eq("id", ctx.B.faqId).select();
      assert.equal(del.data?.length ?? 0, 0);
      const msg = await sb.from("messages").insert({
        company_id: ctx.B.companyId, client_id: ctx.B.clientId, sender_id: who === "client" ? ctx.A.clientId : ctx.A.staffId, body: "hack",
      });
      assert.notEqual(msg.error, null);
      const comp = await sb.from("companies").update({ name: "hacked" }).eq("id", ctx.B.companyId).select();
      assert.equal(comp.data?.length ?? 0, 0);
    });
  }

  test("data of B is intact", async () => {
    const { data: o } = await admin.from("orders").select("title").eq("id", ctx.B.orderId).single();
    const { data: c } = await admin.from("companies").select("name").eq("id", ctx.B.companyId).single();
    const { count } = await admin.from("faqs").select("id", { count: "exact", head: true }).eq("id", ctx.B.faqId);
    assert.equal(o!.title, "Order B");
    assert.equal(c!.name, "RLS B");
    assert.equal(count, 1);
  });

  test("client sees only own orders, staff sees all orders of own company", async () => {
    const { data: mine } = await clientA.from("orders").select("client_id");
    assert.ok(mine!.length >= 1 && mine!.every((o) => o.client_id === ctx.A.clientId));
    const { data: all } = await staffA.from("orders").select("company_id");
    assert.equal(all!.length, 2);
    assert.ok(all!.every((o) => o.company_id === ctx.A.companyId));
  });

  test("client cannot escalate own role or switch company", async () => {
    const role = await clientA.from("profiles").update({ role: "owner" }).eq("id", ctx.A.clientId);
    assert.notEqual(role.error, null);
    const comp = await clientA.from("profiles").update({ company_id: ctx.B.companyId }).eq("id", ctx.A.clientId);
    assert.notEqual(comp.error, null);
  });

  test("anonymous user cannot read orders, messages or profiles", async () => {
    for (const table of ["orders", "messages", "profiles"]) {
      const { data } = await anon.from(table).select("id");
      assert.equal(data?.length ?? 0, 0, `anon sees ${table}`);
    }
  });
});
