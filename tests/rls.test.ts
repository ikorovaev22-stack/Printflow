import { config } from "dotenv";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PRICE_LIST } from "../src/lib/pricing";

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
let clientA: SupabaseClient, clientA2: SupabaseClient, staffA: SupabaseClient, staffB: SupabaseClient, ownerA: SupabaseClient, anon: SupabaseClient;

async function createUser(slug: string, name: string, role: "client" | "staff" | "owner") {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${name}-${run}@rls.test`,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { company_slug: slug, full_name: name },
  });
  if (error) throw error;
  userIds.push(data.user.id);
  if (role !== "client") await admin.from("profiles").update({ role }).eq("id", data.user.id);
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
  await createUser(slug, `owner${key}`, "owner");
  await admin.from("price_lists").insert({ company_id: c.id, config: DEFAULT_PRICE_LIST });
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
  ownerA = await signIn("ownerA");
  anon = createClient(URL, ANON, opts);
});

after(async () => {
  const { data: files } = await admin.from("order_files").select("path").in("company_id", [ctx.A?.companyId, ctx.B?.companyId].filter(Boolean));
  if (files?.length) await admin.storage.from("order-files").remove(files.map((f) => f.path));
  for (const id of [ctx.A?.companyId, ctx.B?.companyId].filter(Boolean)) {
    const { data: images } = await admin.storage.from("banners").list(id);
    if (images?.length) await admin.storage.from("banners").remove(images.map((f) => `${id}/${f.name}`));
  }
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
    const consent = await clientA.from("profiles").update({ pd_consent_at: new Date().toISOString() }).eq("id", ctx.A.clientId);
    assert.notEqual(consent.error, null, "client forges the personal data consent time");
  });

  test("sign-up with consent stamps pd_consent_at, without it leaves it empty", async () => {
    const slug = `rls-a-${run}`;
    const stamped: Record<string, string | null> = {};
    for (const consent of [true, false]) {
      // A fresh client: signing up opens a session, and `anon` must stay anonymous for the other tests
      const { data, error } = await createClient(URL, ANON, opts).auth.signUp({
        email: `signup-${consent}-${run}@rls.test`,
        password: PASSWORD,
        options: { data: { company_slug: slug, full_name: "Signup", ...(consent && { pd_consent: true }) } },
      });
      assert.equal(error, null);
      userIds.push(data.user!.id);
      const { data: p } = await admin.from("profiles").select("pd_consent_at").eq("id", data.user!.id).single();
      stamped[String(consent)] = p!.pd_consent_at;
    }
    assert.ok(stamped.true, "consent time recorded");
    assert.equal(stamped.false, null);
  });

  test("anonymous user cannot read orders, messages or profiles", async () => {
    for (const table of ["orders", "messages", "profiles"]) {
      const { data } = await anon.from(table).select("id");
      assert.equal(data?.length ?? 0, 0, `anon sees ${table}`);
    }
  });
});

// Before the flood test: it uses up client A's message limit for the minute
describe("RLS: deleting messages", () => {
  const message = async (key: "A" | "B", from: "client" | "staff") => {
    const sender = from === "client" ? ctx[key].clientId : ctx[key].staffId;
    const { data, error } = await admin
      .from("messages")
      .insert({ company_id: ctx[key].companyId, client_id: ctx[key].clientId, sender_id: sender, body: `delete me (${from})` })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  };
  const exists = async (id: string) => (await admin.from("messages").select("id").eq("id", id)).data!.length === 1;

  test("clients cannot delete messages, not even their own", async () => {
    for (const id of [await message("A", "client"), await message("A", "staff")]) {
      const { data } = await clientA.from("messages").delete().eq("id", id).select();
      assert.equal(data?.length ?? 0, 0);
      assert.ok(await exists(id), "message deleted by a client");
    }
  });

  test("staff delete any message of their company, but not of another company", async () => {
    const fromClient = await message("A", "client");
    const del = await staffA.from("messages").delete().eq("id", fromClient).select();
    assert.equal(del.data?.length, 1);
    assert.equal(await exists(fromClient), false);
    const foreign = await message("A", "client");
    const hack = await staffB.from("messages").delete().eq("id", foreign).select();
    assert.equal(hack.data?.length ?? 0, 0);
    assert.ok(await exists(foreign), "message deleted by staff of another company");
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

describe("RLS: price calculator", () => {
  const changed = { ...DEFAULT_PRICE_LIST, banners: { ...DEFAULT_PRICE_LIST.banners, hemPerM: 99 } };
  const hem = async (companyId: string) =>
    (await admin.from("price_lists").select("config").eq("company_id", companyId).single()).data!.config.banners.hemPerM;

  test("anyone can read price lists, even before signing in", async () => {
    const { data } = await anon.from("price_lists").select("company_id").eq("company_id", ctx.A.companyId);
    assert.equal(data?.length, 1);
  });

  test("only the owner changes prices, and only their own company's", async () => {
    for (const [who, sb] of [["client", clientA], ["staff", staffA]] as const) {
      const { data } = await sb.from("price_lists").update({ config: changed }).eq("company_id", ctx.A.companyId).select("company_id");
      assert.equal(data?.length ?? 0, 0, `${who} updates the price list`);
    }
    const anonUpdate = await anon.from("price_lists").update({ config: changed }).eq("company_id", ctx.A.companyId);
    assert.notEqual(anonUpdate.error, null, "anonymous update");
    const { data: foreign } = await ownerA.from("price_lists").update({ config: changed }).eq("company_id", ctx.B.companyId).select("company_id");
    assert.equal(foreign?.length ?? 0, 0, "owner A updates company B prices");
    const foreignInsert = await ownerA.from("price_lists").insert({ company_id: ctx.B.companyId, config: changed });
    assert.notEqual(foreignInsert.error, null, "owner A creates prices for company B");
    assert.equal(await hem(ctx.A.companyId), DEFAULT_PRICE_LIST.banners.hemPerM);
    assert.equal(await hem(ctx.B.companyId), DEFAULT_PRICE_LIST.banners.hemPerM);

    const { data: own } = await ownerA.from("price_lists").update({ config: changed }).eq("company_id", ctx.A.companyId).select("company_id");
    assert.equal(own?.length, 1);
    assert.equal(await hem(ctx.A.companyId), 99);
  });

  test("clients cannot create orders; calculator fields are written only by the server", async () => {
    const own = await clientA.from("orders").insert({ company_id: ctx.A.companyId, client_id: ctx.A.clientId, title: "Cheap", price: 1 });
    assert.notEqual(own.error, null, "client inserts an order with any price");
    const forged = await staffA.from("orders").insert({
      company_id: ctx.A.companyId, client_id: ctx.A.clientId, title: "x", source: "calculator", calc: { total: 1 },
    });
    assert.notEqual(forged.error, null, "staff forges a calculator request");
    const calc = await staffA.from("orders").update({ calc: { total: 1 } }).eq("id", ctx.A.orderId);
    assert.notEqual(calc.error, null, "staff rewrites the client's calculation");

    const { data } = await staffA.from("orders").update({ price: 1500 }).eq("id", ctx.A.orderId).select("price");
    assert.equal(data?.[0]?.price, 1500, "staff corrects the price");
    const { data: other } = await staffB.from("orders").update({ price: 1 }).eq("id", ctx.A.orderId).select("id");
    assert.equal(other?.length ?? 0, 0, "staff of another company changes the price");
  });
});

describe("RLS: banners and Telegram", () => {
  // 1×1 PNG
  const png = new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64")], {
    type: "image/png",
  });

  test("only the owner adds banners and uploads their images, only into their own company", async () => {
    const path = `${ctx.A.companyId}/promo-${run}.png`;
    for (const [who, sb] of [["client", clientA], ["staff", staffA]] as const) {
      const upload = await sb.storage.from("banners").upload(`${ctx.A.companyId}/${who}-${run}.png`, png, { contentType: "image/png" });
      assert.notEqual(upload.error, null, `${who} uploads a banner image`);
      const insert = await sb.from("banners").insert({ company_id: ctx.A.companyId, path });
      assert.notEqual(insert.error, null, `${who} adds a banner`);
    }
    const foreignUpload = await ownerA.storage.from("banners").upload(`${ctx.B.companyId}/x-${run}.png`, png, { contentType: "image/png" });
    assert.notEqual(foreignUpload.error, null, "owner A uploads into company B");
    const foreignInsert = await ownerA.from("banners").insert({ company_id: ctx.B.companyId, path: `${ctx.B.companyId}/x.png` });
    assert.notEqual(foreignInsert.error, null, "owner A adds a banner to company B");
    const outside = await ownerA.from("banners").insert({ company_id: ctx.A.companyId, path: `${ctx.B.companyId}/x.png` });
    assert.notEqual(outside.error, null, "banner path outside the company folder");

    assert.equal((await ownerA.storage.from("banners").upload(path, png, { contentType: "image/png" })).error, null);
    const { data: banner, error } = await ownerA.from("banners").insert({ company_id: ctx.A.companyId, path, title: "Акция" }).select().single();
    assert.equal(error, null);
    const { data: seen } = await anon.from("banners").select("id").eq("company_id", ctx.A.companyId);
    assert.equal(seen?.length, 1, "banners are public, like the company card");
    const { data: byStaff } = await staffA.from("banners").delete().eq("id", banner!.id).select("id");
    assert.equal(byStaff?.length ?? 0, 0, "staff deletes a banner");
    const { data: byOwner } = await ownerA.from("banners").delete().eq("id", banner!.id).select("id");
    assert.equal(byOwner?.length, 1);
    const removed = await ownerA.storage.from("banners").remove([path]);
    assert.equal(removed.data?.length, 1, "owner removes the image");
  });

  test("at most 10 banners per company", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ company_id: ctx.B.companyId, path: `${ctx.B.companyId}/limit-${i}.png`, position: i }));
    assert.equal((await admin.from("banners").insert(rows)).error, null);
    const extra = await admin.from("banners").insert({ company_id: ctx.B.companyId, path: `${ctx.B.companyId}/limit-10.png` });
    assert.notEqual(extra.error, null);
  });

  test("Telegram is a plain username, set by the owner", async () => {
    const link = await ownerA.from("companies").update({ telegram: "https://t.me/print_shop" }).eq("id", ctx.A.companyId);
    assert.notEqual(link.error, null, "a link instead of a username");
    const { data: byStaff } = await staffA.from("companies").update({ telegram: "print_shop" }).eq("id", ctx.A.companyId).select("id");
    assert.equal(byStaff?.length ?? 0, 0, "staff changes the company card");
    const { data } = await ownerA.from("companies").update({ telegram: "print_shop" }).eq("id", ctx.A.companyId).select("telegram");
    assert.equal(data?.[0]?.telegram, "print_shop");
  });
});

describe("RLS: MAX, the post-press stage, own items", () => {
  test("MAX is a max.ru link, set by the owner", async () => {
    const foreign = await ownerA.from("companies").update({ max_url: "https://evil.example/u/1" }).eq("id", ctx.A.companyId);
    assert.notEqual(foreign.error, null, "a link to another site");
    const { data } = await ownerA
      .from("companies")
      .update({ max_url: "https://max.ru/u/f9LHodD0cOJt34p_UbhR97c03cMEAAwB", max_phone: "+7 900 000-00-00" })
      .eq("id", ctx.A.companyId)
      .select("max_url, max_phone");
    assert.equal(data?.[0]?.max_url, "https://max.ru/u/f9LHodD0cOJt34p_UbhR97c03cMEAAwB");
  });

  test("switching off «Постпечать» moves its orders to «Печать» and closes the stage", async () => {
    const { data: order } = await admin
      .from("orders")
      .insert({ company_id: ctx.B.companyId, client_id: ctx.B.clientId, title: "Finishing", status: "finishing" })
      .select("id")
      .single();
    const { data: byStaff } = await staffB.from("companies").update({ finishing_stage: false }).eq("id", ctx.B.companyId).select("id");
    assert.equal(byStaff?.length ?? 0, 0, "staff switches the stage");
    assert.equal((await admin.from("companies").update({ finishing_stage: false }).eq("id", ctx.B.companyId)).error, null);

    const { data: moved } = await admin.from("orders").select("status").eq("id", order!.id).single();
    assert.equal(moved?.status, "printing");
    const back = await staffB.from("orders").update({ status: "finishing" }).eq("id", order!.id);
    assert.notEqual(back.error, null, "an order enters a switched-off stage");
    const created = await staffB.from("orders").insert({ company_id: ctx.B.companyId, client_id: ctx.B.clientId, title: "x", status: "finishing" });
    assert.notEqual(created.error, null, "a new order starts in a switched-off stage");
    const elsewhere = await staffA.from("orders").update({ status: "finishing" }).eq("id", ctx.A.orderId);
    assert.equal(elsewhere.error, null, "the stage stays on in other companies");

    await admin.from("companies").update({ finishing_stage: true }).eq("id", ctx.B.companyId);
  });

  test("a price list with own items fits; an oversized one is rejected", async () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ ...DEFAULT_PRICE_LIST.items[0], id: `item${i}`, name: `Позиция ${i}` }));
    const { error } = await admin.from("price_lists").update({ config: { ...DEFAULT_PRICE_LIST, items } }).eq("company_id", ctx.B.companyId);
    assert.equal(error, null);
    const huge = await admin.from("price_lists").update({ config: { ...DEFAULT_PRICE_LIST, junk: "x".repeat(300_000) } }).eq("company_id", ctx.B.companyId);
    assert.notEqual(huge.error, null);
  });
});
