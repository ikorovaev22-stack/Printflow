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
let clientA: SupabaseClient, clientA2: SupabaseClient, staffA: SupabaseClient, staffB: SupabaseClient, anon: SupabaseClient;

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
  clientA2 = await signIn("clientA2");
  staffA = await signIn("staffA");
  staffB = await signIn("staffB");
  anon = createClient(URL, ANON, opts);
});

after(async () => {
  const { data: files } = await admin.from("order_files").select("path").in("company_id", [ctx.A?.companyId, ctx.B?.companyId].filter(Boolean));
  if (files?.length) await admin.storage.from("order-files").remove(files.map((f) => f.path));
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

  test("protected columns and roles cannot be forged", async () => {
    const msg = await clientA.from("messages").insert({
      company_id: ctx.A.companyId, client_id: ctx.A.clientId, sender_id: ctx.A.clientId, body: "x", read_at: new Date().toISOString(),
    });
    assert.notEqual(msg.error, null, "client sets read_at on insert");
    const num = await staffA.from("orders").update({ number: 999 }).eq("id", ctx.A.orderId);
    assert.notEqual(num.error, null, "staff changes order number");
    const staffOrder = await staffA.from("orders").insert({ company_id: ctx.A.companyId, client_id: ctx.A.staffId, title: "x" });
    assert.notEqual(staffOrder.error, null, "order for a staff profile");
    const staffThread = await staffA.from("messages").insert({
      company_id: ctx.A.companyId, client_id: ctx.A.staffId, sender_id: ctx.A.staffId, body: "x",
    });
    assert.notEqual(staffThread.error, null, "chat thread for a staff profile");
    const logo = await admin.from("companies").update({ logo_url: "http://127.0.0.1/x.png" }).eq("id", ctx.A.companyId);
    assert.notEqual(logo.error, null, "external logo_url");
  });

  test("anonymous user cannot read orders, messages or profiles", async () => {
    for (const table of ["orders", "messages", "profiles"]) {
      const { data } = await anon.from(table).select("id");
      assert.equal(data?.length ?? 0, 0, `anon sees ${table}`);
    }
  });
});

const pdf = () => new Blob(["%PDF-1.4 test"], { type: "application/pdf" });

describe("RLS: history, files, notifications, limits", () => {
  test("status changes are logged and visible only to the order's client and staff", async () => {
    const { error } = await staffA.from("orders").update({ status: "design" }).eq("id", ctx.A.orderId);
    assert.equal(error, null);
    const { data: own } = await clientA.from("order_events").select("status").eq("order_id", ctx.A.orderId).order("created_at");
    assert.deepEqual(own!.map((e) => e.status), ["accepted", "design"]);
    const { data: other } = await clientA2.from("order_events").select("id").eq("order_id", ctx.A.orderId);
    assert.equal(other!.length, 0, "another client sees the history");
    const { data: foreign } = await staffB.from("order_events").select("id").eq("order_id", ctx.A.orderId);
    assert.equal(foreign!.length, 0, "staff of B sees the history of A");
    const { error: forged } = await staffA.from("order_events").insert({ order_id: ctx.A.orderId, company_id: ctx.A.companyId, status: "ready" });
    assert.notEqual(forged, null, "history can be written directly");
  });

  test("client uploads a layout to own order; origin cannot be forged", async () => {
    const path = `${ctx.A.companyId}/${ctx.A.orderId}/${run}-layout.pdf`;
    const up = await clientA.storage.from("order-files").upload(path, pdf(), { contentType: "application/pdf" });
    assert.equal(up.error, null);
    const { data, error } = await clientA
      .from("order_files")
      .insert({ order_id: ctx.A.orderId, company_id: ctx.A.companyId, uploaded_by: ctx.A.clientId, name: "Макет.pdf", path, size: 13, mime: "application/pdf" })
      .select("from_client")
      .single();
    assert.equal(error, null);
    assert.equal(data!.from_client, true);
    const signed = await staffA.storage.from("order-files").createSignedUrl(path, 60);
    assert.equal(signed.error, null, "staff of the company cannot download the layout");
  });

  test("files of an order are hidden from other clients and other companies", async () => {
    const { data: a2 } = await clientA2.from("order_files").select("id").eq("order_id", ctx.A.orderId);
    assert.equal(a2!.length, 0, "another client sees the files");
    const { data: b } = await staffB.from("order_files").select("id").eq("order_id", ctx.A.orderId);
    assert.equal(b!.length, 0, "staff of B sees the files");
    const path = `${ctx.A.companyId}/${ctx.A.orderId}/${run}-layout.pdf`;
    const dl = await clientA2.storage.from("order-files").createSignedUrl(path, 60);
    assert.notEqual(dl.error, null, "another client can download the file");
  });

  test("client cannot upload into another order or another company", async () => {
    const intoB = await clientA.storage.from("order-files").upload(`${ctx.B.companyId}/${ctx.B.orderId}/${run}-x.pdf`, pdf(), { contentType: "application/pdf" });
    assert.notEqual(intoB.error, null, "upload into company B succeeded");
    const { data: otherOrder } = await admin.from("orders").select("id").eq("company_id", ctx.A.companyId).neq("client_id", ctx.A.clientId).limit(1).single();
    const intoOther = await clientA.storage.from("order-files").upload(`${ctx.A.companyId}/${otherOrder!.id}/${run}-x.pdf`, pdf(), { contentType: "application/pdf" });
    assert.notEqual(intoOther.error, null, "upload into another client's order succeeded");
    const { error } = await clientA.from("order_files").insert({
      order_id: otherOrder!.id, company_id: ctx.A.companyId, uploaded_by: ctx.A.clientId, name: "x.pdf", path: `${ctx.A.companyId}/${otherOrder!.id}/${run}-y.pdf`, size: 1,
    });
    assert.notEqual(error, null, "file row attached to another client's order");
  });

  test("push subscriptions are private to their owner", async () => {
    const endpoint = `https://push.example/${run}`;
    const { error } = await clientA.rpc("save_push_subscription", { p_endpoint: endpoint, p_p256dh: "k", p_auth: "a" });
    assert.equal(error, null);
    const { data: own } = await clientA.from("push_subscriptions").select("endpoint");
    assert.equal(own!.length, 1);
    const { data: staffView } = await staffA.from("push_subscriptions").select("endpoint");
    assert.equal(staffView!.length, 0, "staff can read client subscriptions");
    const { error: anonErr } = await anon.rpc("save_push_subscription", { p_endpoint: "x", p_p256dh: "k", p_auth: "a" });
    assert.notEqual(anonErr, null, "anonymous user can save a subscription");
  });

  test("chat flood is limited to 20 messages per minute", async () => {
    let failedAt = 0;
    for (let i = 1; i <= 25 && !failedAt; i++) {
      const { error } = await clientA.from("messages").insert({ company_id: ctx.A.companyId, client_id: ctx.A.clientId, sender_id: ctx.A.clientId, body: `flood ${i}` });
      if (error) failedAt = i;
    }
    assert.ok(failedAt > 0 && failedAt <= 21, `limit not enforced (failed at ${failedAt})`);
  });

  test("oversized fields are rejected", async () => {
    const { error } = await staffA.from("orders").insert({ company_id: ctx.A.companyId, client_id: ctx.A.clientId, title: "x".repeat(201) });
    assert.notEqual(error, null, "201-char title accepted");
  });
});
