// AI assistant: the three prompts, what the model is told and how its answers are read. Pure functions (unit-tested);
// the model call, page reading and database work are in assistant-server.ts

export type AiMode = "off" | "draft" | "auto";
export type PromptKind = "reply" | "knowledge" | "content";
export type DraftKind = "reply" | "post" | "faq";
export type ModelMessage = { role: "system" | "user" | "assistant"; content: string };

export const AI_MODES: { value: AiMode; label: string; hint: string }[] = [
  { value: "off", label: "Выключен", hint: "ИИ не читает чат" },
  { value: "draft", label: "Черновики", hint: "На каждое сообщение клиента ИИ пишет черновик, менеджер проверяет и отправляет" },
  { value: "auto", label: "Отвечает сам", hint: "Простые вопросы ИИ закрывает сам, сложные передаёт менеджеру" },
];

export const DEFAULT_HANDOFF_TEXT = "Передал ваш вопрос менеджеру — он ответит здесь в рабочее время.";

// One instruction per line: the owner edits these in the panel
export const PROMPTS: Record<PromptKind, { label: string; hint: string; text: string }> = {
  reply: {
    label: "Ответы клиентам",
    hint: "Как автоответчик говорит с клиентами в чате и когда зовёт менеджера",
    text: [
      "Ты — помощник типографии в чате с клиентом. Отвечай по-русски, на «вы», коротко и по делу: 1–3 предложения.",
      "Опирайся только на сведения о типографии, шаблоны ответов и базу знаний. Про заказ клиента отвечай по его заказам.",
      "Не обещай цен, сроков и скидок, которых нет в сведениях; для расчёта стоимости предлагай калькулятор.",
      "Передавай вопрос менеджеру, если: ответа нет в сведениях; клиент недоволен или жалуется; нужен расчёт нестандартного заказа, скидка или срочность сверх обычной; клиент просит позвать человека; речь о деньгах, возврате или переделке.",
    ].join("\n"),
  },
  knowledge: {
    label: "Чтение страниц сайта",
    hint: "Как ИИ превращает страницу сайта в запись базы знаний",
    text: [
      "Перед тобой текст страницы сайта типографии.",
      "Выпиши то, что пригодится для ответов клиентам: услуги и продукцию, цены и от чего они зависят, сроки, требования к макетам, оплату, доставку и самовывоз, адреса, контакты, часы работы, акции.",
      "Пиши коротко, списком, своими словами, без рекламных оборотов и повторов. Ничего не добавляй от себя.",
    ].join("\n"),
  },
  content: {
    label: "Новости и вопросы",
    hint: "Как ИИ пишет черновики новостей и вопросов для клиентов",
    text: [
      "Пиши для клиентов типографии: просто, дружелюбно и по делу, без канцелярита, без восклицательных знаков и эмодзи.",
      "Новость или акция: заголовок до 70 знаков и текст 2–4 коротких абзаца, в конце — что сделать клиенту.",
      "Вопрос для раздела «Вопросы и ответы»: вопрос словами клиента и точный ответ в 1–4 предложения.",
      "Используй только факты из сведений о типографии и базы знаний, цифры не придумывай.",
    ].join("\n"),
  },
};

// Fixed parts the owner does not edit: the answer format the server parses
const REPLY_FORMAT = `Формат ответа — строго один JSON-объект, без пояснений и разметки:
{"action": "answer", "answer": "текст ответа клиенту"} — если ответ есть в сведениях;
{"action": "handoff", "reason": "коротко, зачем нужен менеджер"} — если вопрос нужно передать менеджеру.
Если вопрос по смыслу совпадает с шаблоном ответа, ответь текстом шаблона.`;
const KNOWLEDGE_FORMAT = "Верни только текст записи — без вступления и заключения, не длиннее 4000 знаков.";
const POST_FORMAT = 'Формат ответа — строго один JSON-объект без разметки: {"title": "заголовок", "body": "текст"}';
const FAQ_FORMAT = 'Формат ответа — строго один JSON-объект без разметки: {"question": "вопрос", "answer": "ответ"}';
const FAQ_SUGGEST_FORMAT = `Предложи до 3 новых вопросов для раздела «Вопросы и ответы» — тех, что клиенты задают в чате,
а в разделе их ещё нет. Формат ответа — строго один JSON-объект без разметки:
{"items": [{"question": "вопрос", "answer": "ответ"}]}. Если предложить нечего, верни {"items": []}.`;

export type Knowledge = {
  company: { name: string; address: string | null; work_hours: string | null; phone: string | null; email: string | null; telegram: string | null; max_url: string | null };
  calculator: { url: string; products: string[] } | null;
  templates: { question: string; answer: string }[];
  faqs: { question: string; answer: string }[];
  entries: { title: string; body: string }[];
  posts: { title: string; body: string }[];
};

export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Everything the model may rely on, as one text; long knowledge bases are cut from the end
export function knowledgeText(k: Knowledge, limit = 40_000) {
  const c = k.company;
  const card = [
    `Название: ${c.name}`,
    c.address && `Адрес: ${c.address}`,
    c.work_hours && `Часы работы: ${c.work_hours}`,
    c.phone && `Телефон: ${c.phone}`,
    c.email && `Email: ${c.email}`,
    c.telegram && `Telegram: @${c.telegram}`,
    c.max_url && `MAX: ${c.max_url}`,
  ].filter(Boolean);
  const qa = (list: { question: string; answer: string }[]) => list.map((x) => `В: ${x.question}\nО: ${x.answer}`).join("\n\n");
  const parts = [
    `## Типография\n${card.join("\n")}`,
    k.calculator &&
      `## Калькулятор\nКлиент сам считает цену в калькуляторе приложения (${k.calculator.url}): ${k.calculator.products.join(", ")}. ` +
        "Точная цена — там, менеджер подтверждает её после проверки макета.",
    k.templates.length && `## Шаблоны ответов\n${qa(k.templates)}`,
    k.faqs.length && `## Вопросы и ответы из приложения\n${qa(k.faqs)}`,
    k.entries.length && `## База знаний\n${k.entries.map((e) => `### ${e.title}\n${e.body}`).join("\n\n")}`,
    k.posts.length && `## Последние новости\n${k.posts.map((p) => `### ${p.title}\n${clip(p.body, 600)}`).join("\n\n")}`,
  ].filter(Boolean) as string[];
  return clip(parts.join("\n\n"), limit);
}

export type ChatTurn = { fromClient: boolean; body: string };
export type ClientOrder = { number: number; title: string; status: string; due: string | null };

// The conversation goes as turns: the client is "user", the print shop (people and the assistant) is "assistant"
export function replyMessages({
  prompt,
  knowledge,
  orders,
  history,
}: {
  prompt: string;
  knowledge: string;
  orders: ClientOrder[] | null;
  history: ChatTurn[];
}): ModelMessage[] {
  const ordersText =
    orders === null
      ? ""
      : `\n\n## Заказы клиента\n${
          orders.length
            ? orders.map((o) => `№${o.number} «${o.title}»: ${o.status}${o.due ? `, срок ${o.due}` : ""}`).join("\n")
            : "Текущих заказов нет"
        }`;
  return [
    { role: "system", content: `${prompt}\n\n${REPLY_FORMAT}\n\n# Сведения\n${knowledge}${ordersText}` },
    ...history.slice(-20).map((t): ModelMessage => ({ role: t.fromClient ? "user" : "assistant", content: clip(t.body, 2000) })),
  ];
}

export function knowledgeMessages({ prompt, url, title, text }: { prompt: string; url: string; title: string; text: string }): ModelMessage[] {
  return [
    { role: "system", content: `${prompt}\n\n${KNOWLEDGE_FORMAT}` },
    { role: "user", content: `Страница: ${title || url}\nАдрес: ${url}\n\n${clip(text, 30_000)}` },
  ];
}

export function contentMessages({ prompt, knowledge, kind, topic }: { prompt: string; knowledge: string; kind: "post" | "faq"; topic: string }): ModelMessage[] {
  return [
    { role: "system", content: `${prompt}\n\n${kind === "post" ? POST_FORMAT : FAQ_FORMAT}\n\n# Сведения\n${knowledge}` },
    { role: "user", content: `${kind === "post" ? "Напиши новость" : "Напиши вопрос и ответ"}. Тема: ${clip(topic, 2000)}` },
  ];
}

export function faqSuggestMessages({ prompt, knowledge, questions, existing }: { prompt: string; knowledge: string; questions: string[]; existing: string[] }): ModelMessage[] {
  return [
    { role: "system", content: `${prompt}\n\n${FAQ_SUGGEST_FORMAT}\n\n# Сведения\n${knowledge}` },
    {
      role: "user",
      content: `Сообщения клиентов из чата:\n${questions.map((q) => `- ${clip(q, 300)}`).join("\n") || "нет"}\n\n` +
        `Уже есть в разделе «Вопросы и ответы»:\n${existing.map((q) => `- ${q}`).join("\n") || "ничего"}`,
    },
  ];
}

// Models wrap JSON in ```json fences or add a sentence around it: take the outermost object
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export type ReplyDecision = { action: "answer"; answer: string } | { action: "handoff"; reason: string };

export function parseReply(text: string): ReplyDecision | null {
  const o = parseJsonObject(text);
  if (!o) return null;
  if (o.action === "handoff") return { action: "handoff", reason: clip(str(o.reason) || "ИИ не нашёл ответа", 500) };
  const answer = str(o.answer);
  return o.action === "answer" && answer ? { action: "answer", answer: clip(answer, 4000) } : null;
}

export function parseContent(text: string, kind: "post" | "faq"): { title: string; body: string } | null {
  const o = parseJsonObject(text);
  const title = str(kind === "post" ? o?.title : o?.question);
  const body = str(kind === "post" ? o?.body : o?.answer);
  return title && body ? { title: clip(title, kind === "post" ? 200 : 300), body: clip(body, 5000) } : null;
}

export function parseFaqItems(text: string): { question: string; answer: string }[] {
  const items = parseJsonObject(text)?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map((i) => ({ question: clip(str(i?.question), 300), answer: clip(str(i?.answer), 5000) }))
    .filter((i) => i.question && i.answer)
    .slice(0, 3);
}

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", laquo: "«", raquo: "»", mdash: "—", ndash: "–",
  hellip: "…", bull: "•", middot: "·", copy: "©", reg: "®", trade: "™", deg: "°", times: "×", rarr: "→", larr: "←",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", bdquo: "„", minus: "−", shy: "",
};

export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

// Readable text of a page: no scripts, styles or markup; blocks become lines, list items get bullets
export function htmlToText(html: string): { title: string; text: string } {
  const title = decodeEntities(
    (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)/i)?.[1] ?? "")
      .replace(/\s+/g, " ")
      .trim(),
  );
  const text = decodeEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template|iframe|head|canvas|select)\b[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<li\b[^>]*>/gi, "\n• ")
      .replace(/<(br|hr)\b[^>]*>/gi, "\n")
      .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|table|section|article|header|footer|main|aside|nav|blockquote|dd|dt|form|address)\s*>/gi, "\n")
      .replace(/<\/(td|th)\s*>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter((line, i, lines) => line && line !== "•" && line !== lines[i - 1])
    .join("\n");
  return { title: clip(title, 200), text: clip(text, 50_000) };
}
