// OpenAI-compatible stand-in for the AI assistant in E2E: answers by the format the server asks for.
// The app must point at it: AI_BASE_URL=http://127.0.0.1:4010/v1 AI_API_KEY=test AI_MODEL=mock AI_REPLY_DELAY_MS=0
import { createServer } from "node:http";

type Message = { role: string; content: string };

function answer(messages: Message[]) {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const last = messages.at(-1)?.content ?? "";
  if (system.includes('"action": "handoff"')) {
    return /скидк|человек/i.test(last)
      ? { action: "handoff", reason: "Клиент просит скидку — решает менеджер" }
      : { action: "answer", answer: "Здравствуйте! Визитки печатаем от 1 дня, цену покажет калькулятор." };
  }
  if (system.includes('"items"')) return { items: [{ question: "Сколько стоит доставка?", answer: "По Москве — 500 ₽, бесплатно от 5000 ₽." }] };
  if (system.includes('"title": "заголовок"')) return { title: "Скидка 10% на визитки", body: "До конца месяца визитки дешевле на 10%.\n\nОформите заказ в калькуляторе." };
  if (system.includes('"question": "вопрос"')) return { question: "Можно прислать макет в Word?", answer: "Да, мы переведём его в PDF и пришлём на согласование." };
  return `• ${last.split("\n")[0]}\n• Факты со страницы для базы знаний`;
}

createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") return res.end("ok");
  if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) {
    res.statusCode = 404;
    return res.end();
  }
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw) as { messages: Message[] };
    const out = answer(body.messages);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: typeof out === "string" ? out : JSON.stringify(out) } }] }));
  });
}).listen(4010, "127.0.0.1");
