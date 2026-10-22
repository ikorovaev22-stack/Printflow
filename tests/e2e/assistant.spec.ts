import { expect, test, type Browser, type Page } from "@playwright/test";
import { CLIENT_STATE, OWNER_STATE } from "./helpers";

// The AI assistant, as the owner sets it up. Specs marked "model" need the stand-in model (see playwright.config.ts)
test.use({ storageState: OWNER_STATE });
test.beforeEach(({ page }) => page.on("dialog", (d) => d.accept()));

async function modelOn(page: Page) {
  await page.goto("/admin/ai");
  await expect(page.getByRole("heading", { name: "Автоответчик в чате" })).toBeVisible();
  return !(await page.getByText("Нейросеть не подключена").isVisible());
}

async function setMode(page: Page, mode: "Выключен" | "Черновики" | "Отвечает сам") {
  await page.goto("/admin/ai");
  await page.getByRole("radio", { name: new RegExp(`^${mode}`) }).check();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Сохранено")).toBeVisible();
}

// A client of their own: the demo client's chat has a manager's recent message, and in auto mode the assistant
// keeps quiet while a manager is in the conversation
async function newClient(browser: Browser, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/c/artproject/register");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Имя и фамилия").fill(name);
  await page.getByLabel("Email").fill(`ai-${Date.now()}@example.com`);
  await page.getByLabel("Пароль", { exact: true }).fill("Assistant-1");
  await page.getByRole("checkbox", { name: /обработку персональных данных/ }).check();
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await expect(page).toHaveURL(/\/c\/artproject$/);
  return { context, page };
}

async function say(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Сообщение" }).fill(text);
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.getByRole("log", { name: "Переписка" }).getByText(text)).toBeVisible();
}

test("prompts, knowledge entries and templates are kept", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/admin/ai/prompts");
  const prompt = page.getByLabel("Ответы клиентам");
  await prompt.fill(`Отвечай очень коротко, e2e ${stamp}`);
  await page.getByRole("button", { name: "Сохранить" }).first().click();
  await expect(page.getByText("Промпт сохранён")).toBeVisible();
  await page.reload();
  await expect(prompt).toHaveValue(`Отвечай очень коротко, e2e ${stamp}`);
  await page.getByRole("button", { name: "Вернуть исходный" }).click();
  await expect(prompt).toHaveValue(/^Ты — помощник типографии/);

  await page.goto("/admin/ai/knowledge");
  await page.getByRole("button", { name: "Добавить запись" }).click();
  await page.getByLabel("Заголовок").fill(`Доставка, e2e ${stamp}`);
  await page.getByLabel("Текст").fill("По Москве курьером — 500 ₽, бесплатно от 5000 ₽.");
  await page.getByRole("dialog").getByRole("button", { name: "Сохранить" }).click();
  const entry = page.getByRole("listitem").filter({ hasText: `Доставка, e2e ${stamp}` });
  await expect(entry).toContainText("Написано вручную");
  await entry.getByRole("switch").click();
  await expect(entry.getByRole("switch")).not.toBeChecked();
  await entry.getByRole("button", { name: "Удалить" }).click();
  await expect(entry).toHaveCount(0);

  await page.goto("/admin/ai");
  await page.getByRole("button", { name: "Добавить шаблон" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Вопрос клиента").fill(`Можно оплатить по счёту? e2e ${stamp}`);
  await form.getByLabel("Ответ").fill("Да, выставим счёт на юрлицо.");
  await form.getByRole("button", { name: "Сохранить" }).click();
  const template = page.getByRole("listitem").filter({ hasText: `Можно оплатить по счёту? e2e ${stamp}` });
  await expect(template).toBeVisible();
  await template.getByRole("button", { name: "Удалить шаблон" }).click();
  await expect(template).toHaveCount(0);
});

test("a news draft is checked, published and seen by clients", async ({ page, browser }) => {
  const title = `Работаем 4 ноября, e2e ${Date.now()}`;
  await page.goto("/admin/ai/publications");
  await page.getByLabel("О чём написать").fill(`${title}\nВ праздник открыты с 10:00 до 16:00.`);
  await page.getByRole("button", { name: "Сохранить мой текст" }).click();
  const draft = page.getByRole("article", { name: "Черновик: Новость" }).first();
  await expect(draft.getByRole("textbox", { name: "Заголовок" })).toHaveValue(title);
  await draft.getByRole("textbox", { name: "Текст" }).fill("В праздник открыты с 10:00 до 15:00.");
  await draft.getByRole("button", { name: "Опубликовать" }).click();
  await expect(page.getByText("Новость опубликована")).toBeVisible();

  const client = await browser.newContext({ storageState: CLIENT_STATE });
  const home = await client.newPage();
  await home.goto("/c/artproject");
  await home.getByRole("link", { name: new RegExp(title) }).click();
  await expect(home.getByRole("heading", { name: title })).toBeVisible();
  await expect(home.getByText("В праздник открыты с 10:00 до 15:00.")).toBeVisible();
  await client.close();

  await page.reload();
  const published = page.getByRole("listitem").filter({ hasText: title });
  await published.getByRole("button", { name: "Удалить новость" }).click();
  await expect(published).toHaveCount(0);
});

test.describe("with a model", () => {
  test.beforeEach(async ({ page }) => test.skip(!(await modelOn(page)), "the app runs without AI_BASE_URL"));

  test("checks an answer and writes FAQ drafts without sending anything", async ({ page }) => {
    await page.getByLabel("Вопрос клиента").fill("Сколько стоят визитки?");
    await page.getByRole("button", { name: "Проверить ответ" }).click();
    await expect(page.getByText("Визитки печатаем от 1 дня")).toBeVisible();
    await page.getByLabel("Вопрос клиента").fill("Сделаете скидку 20%?");
    await page.getByRole("button", { name: "Проверить ответ" }).click();
    await expect(page.getByText("Передаст менеджеру.")).toBeVisible();

    await page.goto("/admin/ai/publications");
    await page.getByRole("radio", { name: /Вопрос для раздела/ }).click();
    await page.getByLabel("О чём написать").fill("макеты в Word");
    await page.getByRole("button", { name: "Написать с ИИ" }).click();
    await expect(page.getByText("Черновик готов — проверьте и опубликуйте")).toBeVisible();
    const draft = page.getByRole("article", { name: "Черновик: Вопрос и ответ" }).first();
    await expect(draft.getByRole("textbox", { name: "Вопрос" })).toHaveValue("Можно прислать макет в Word?");
    const count = await page.getByRole("article").count();
    await draft.getByRole("button", { name: "Отклонить" }).click();
    await expect(page.getByRole("article")).toHaveCount(count - 1);
  });

  test("draft mode: a manager edits the assistant's reply and sends it", async ({ page, browser }) => {
    await setMode(page, "Черновики");
    try {
      const client = await browser.newContext({ storageState: CLIENT_STATE });
      const chat = await client.newPage();
      await chat.goto("/c/artproject/chat");
      await say(chat, `Когда будут готовы визитки? e2e ${Date.now()}`);

      await page.goto("/admin/clients");
      await page.getByRole("link", { name: "Елена Соколова" }).click();
      await page.getByRole("link", { name: "Написать" }).click();
      const draft = page.getByRole("region", { name: "Черновик ответа ИИ" });
      await expect(draft.getByRole("textbox")).toHaveValue(/Визитки печатаем от 1 дня/, { timeout: 15_000 });
      const reply = `Визитки будут готовы завтра к 12:00, e2e ${Date.now()}`;
      await draft.getByRole("textbox").fill(reply);
      await draft.getByRole("button", { name: "Отправить клиенту" }).click();
      await expect(page.getByRole("log", { name: "Переписка" }).getByText(reply)).toBeVisible();
      await expect(draft).toHaveCount(0);
      await expect(chat.getByText(reply)).toBeVisible();
      await client.close();
    } finally {
      await setMode(page, "Выключен");
    }
  });

  test("auto mode: answers simple questions, passes a discount request to a manager", async ({ page, browser }) => {
    const name = `ИИ Клиент ${Date.now()}`;
    await setMode(page, "Отвечает сам");
    try {
      const { context, page: app } = await newClient(browser, name);
      await app.goto("/c/artproject/chat");
      await say(app, "Сколько стоят визитки?");
      const log = app.getByRole("log", { name: "Переписка" });
      await expect(log.getByText("Визитки печатаем от 1 дня")).toBeVisible({ timeout: 15_000 });
      await expect(log.getByText("ИИ-помощник ·").first()).toBeVisible();
      await say(app, "А скидку сделаете?");
      await expect(log.getByText("Передал ваш вопрос менеджеру")).toBeVisible({ timeout: 15_000 });
      await context.close();

      await page.goto("/admin/chat");
      const dialog = page.getByRole("complementary").getByRole("link", { name: new RegExp(name) });
      await expect(dialog).toContainText("Нужен менеджер");
      await dialog.click();
      await expect(page.getByText("ИИ передал вопрос вам.")).toBeVisible();
      await expect(page.getByText("Клиент просит скидку")).toBeVisible();

      await page.goto("/admin/clients");
      await page.getByRole("link", { name }).click();
      await page.getByRole("button", { name: "Удалить" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();
      await expect(page).toHaveURL(/\/admin\/clients$/);
    } finally {
      await setMode(page, "Выключен");
    }
  });
});
