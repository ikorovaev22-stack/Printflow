import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  htmlToText,
  knowledgeText,
  parseContent,
  parseFaqItems,
  parseJsonObject,
  parseReply,
  replyMessages,
  type Knowledge,
} from "../src/lib/assistant";
import { isPublicAddress, parsePublicUrl } from "../src/lib/safe-fetch";

const knowledge: Knowledge = {
  company: { name: "Оттиск", address: "Москва, ул. Печатная, 1", work_hours: "Пн–Пт 9–19", phone: "+7 900 000-00-00", email: null, telegram: "ottisk", max_url: null },
  calculator: { url: "https://app.example.ru/c/demo/calculator", products: ["Визитки", "Баннеры"] },
  templates: [{ question: "Можно оплатить по счёту?", answer: "Да, выставим счёт на юрлицо." }],
  faqs: [{ question: "Сроки?", answer: "От 1 дня." }],
  entries: [{ title: "Макеты", body: "PDF, 300 dpi, вылеты 2 мм." }],
  posts: [],
};

describe("model answers", () => {
  test("a reply is read from JSON, even inside a code fence or with words around it", () => {
    assert.deepEqual(parseReply('```json\n{"action": "answer", "answer": " Да, можно. "}\n```'), { action: "answer", answer: "Да, можно." });
    assert.deepEqual(parseReply('Вот ответ: {"action":"handoff","reason":"скидка"} — всё'), { action: "handoff", reason: "скидка" });
    assert.deepEqual(parseReply('{"action":"handoff"}'), { action: "handoff", reason: "ИИ не нашёл ответа" });
  });

  test("anything else is not a reply: no JSON, an unknown action, an empty answer", () => {
    for (const text of ["Да, можно", '{"action":"answer","answer":"  "}', '{"action":"maybe"}', "{broken", "[1,2]"]) {
      assert.equal(parseReply(text), null, text);
    }
    assert.equal(parseJsonObject('["a"]'), null);
  });

  test("long answers are cut to what a chat message holds", () => {
    const r = parseReply(JSON.stringify({ action: "answer", answer: "а".repeat(5000) }));
    assert.equal(r?.action === "answer" && r.answer.length, 4000);
  });

  test("news and FAQ drafts need both parts", () => {
    assert.deepEqual(parseContent('{"title":"Скидка","body":"10% на визитки"}', "post"), { title: "Скидка", body: "10% на визитки" });
    assert.deepEqual(parseContent('{"question":"Word?","answer":"Да"}', "faq"), { title: "Word?", body: "Да" });
    assert.equal(parseContent('{"title":"Скидка"}', "post"), null);
    assert.equal(parseContent('{"title":"x","body":"y"}', "faq"), null);
  });

  test("FAQ suggestions: at most three complete items", () => {
    const items = [1, 2, 3, 4].map((i) => ({ question: `В${i}`, answer: `О${i}` }));
    assert.equal(parseFaqItems(JSON.stringify({ items })).length, 3);
    assert.deepEqual(parseFaqItems('{"items":[{"question":"В"},{"question":"В2","answer":"О2"}]}'), [{ question: "В2", answer: "О2" }]);
    assert.deepEqual(parseFaqItems('{"items":"нет"}'), []);
  });
});

describe("what the model is told", () => {
  test("the knowledge text has the company card, calculator, templates, FAQ and entries", () => {
    const text = knowledgeText(knowledge);
    for (const part of ["Название: Оттиск", "Telegram: @ottisk", "Визитки, Баннеры", "Можно оплатить по счёту?", "От 1 дня.", "### Макеты"]) {
      assert.ok(text.includes(part), part);
    }
    assert.ok(!text.includes("Email:"), "empty fields are left out");
    assert.equal(knowledgeText({ ...knowledge, entries: [{ title: "Много", body: "я".repeat(50_000) }] }).length, 40_000);
  });

  test("the conversation: client turns are user, the print shop's are assistant; orders when known", () => {
    const messages = replyMessages({
      prompt: "ПРАВИЛА",
      knowledge: "СВЕДЕНИЯ",
      orders: [{ number: 7, title: "Визитки", status: "Печать", due: "23 окт." }],
      history: [
        { fromClient: true, body: "Здравствуйте" },
        { fromClient: false, body: "Добрый день" },
        { fromClient: true, body: "Где мой заказ?" },
      ],
    });
    assert.deepEqual(messages.map((m) => m.role), ["system", "user", "assistant", "user"]);
    assert.ok(messages[0].content.startsWith("ПРАВИЛА"));
    assert.ok(messages[0].content.includes('"action": "handoff"'), "the answer format is always added");
    assert.ok(messages[0].content.includes("№7 «Визитки»: Печать, срок 23 окт."));
    const test = replyMessages({ prompt: "П", knowledge: "С", orders: null, history: [{ fromClient: true, body: "?" }] });
    assert.ok(!test[0].content.includes("Заказы клиента"), "the panel's test has no client");
  });
});

describe("site pages", () => {
  test("page text: no scripts or styles, blocks on their own lines, entities decoded", () => {
    const { title, text } = htmlToText(`<!doctype html><html><head><title>Услуги &laquo;Оттиск&raquo;</title>
      <style>.a{color:red}</style><script>alert("x")</script></head><body>
      <nav><a href="/">Главная</a></nav><h1>Визитки</h1><p>От&nbsp;500&nbsp;₽ за&nbsp;100&nbsp;шт.</p>
      <ul><li>Матовые</li><li>Глянцевые</li></ul><!-- hidden --><table><tr><td>A4</td><td>10 ₽</td></tr></table>
      <footer>Адрес: ул. Печатная, 1 &#8212; тел. &#x2B;7</footer></body></html>`);
    assert.equal(title, "Услуги «Оттиск»");
    assert.ok(!/alert|color:red|hidden/.test(text));
    assert.deepEqual(text.split("\n"), ["Главная", "Визитки", "От 500 ₽ за 100 шт.", "• Матовые", "• Глянцевые", "A4 10 ₽", "Адрес: ул. Печатная, 1 — тел. +7"]);
  });

  test("only public internet addresses are read", () => {
    for (const ip of ["8.8.8.8", "77.88.55.242", "2a02:6b8::2:242", "::ffff:8.8.8.8"]) assert.ok(isPublicAddress(ip), ip);
    const internal = [
      "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
      "::1", "::", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a9fe:a9fe", "2002:c0a8:101::1", "2001:db8::1", "not-an-ip",
    ];
    for (const ip of internal) assert.equal(isPublicAddress(ip), false, ip);
  });

  test("page addresses: http(s) on standard ports, no credentials, no internal hosts", () => {
    assert.equal(parsePublicUrl("https://ottisk.ru/uslugi#prices").toString(), "https://ottisk.ru/uslugi");
    for (const url of ["ftp://ottisk.ru", "https://user:pw@ottisk.ru", "https://ottisk.ru:8080", "http://localhost", "http://127.0.0.1", "http://[::1]/", "http://intranet", "https://printer.local", "javascript:alert(1)"]) {
      assert.throws(() => parsePublicUrl(url), url);
    }
  });
});
