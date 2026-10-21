import { expect, test } from "@playwright/test";
import { formatRub } from "../../src/lib/format";
import { CLIENT, OWNER_STATE } from "./helpers";

test("a client account cannot enter the staff panel", async ({ page }) => {
  await page.goto("/admin/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(CLIENT);
  await page.getByLabel("Пароль", { exact: true }).fill("Demo1234!");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByText("нет доступа к панели управления")).toBeVisible();
});

test.describe("signed-in owner", () => {
  test.use({ storageState: OWNER_STATE });
  test.beforeEach(({ page }) => page.goto("/admin/orders"));

  test("sees order KPIs and filters overdue orders", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Заказы" })).toBeVisible();
    await page.getByRole("link", { name: /Просрочены/ }).click();
    await expect(page).toHaveURL(/status=overdue/);
  });

  test("changes an order status from the table", async ({ page }) => {
    const row = page.getByRole("row", { name: /Свадебные приглашения/ });
    const current = (await row.getByRole("combobox").innerText()).trim();
    await row.getByRole("combobox").click();
    await page.getByRole("option", { name: current === "Печать" ? "Макет" : "Печать", exact: true }).click();
    await expect(page.getByText("Заказ обновлён")).toBeVisible();
  });

  test("order page shows files and stage history", async ({ page }) => {
    await page.getByRole("link", { name: "Каталог продукции, 40 стр." }).click();
    await expect(page.getByRole("heading", { name: "Файлы" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "История этапов" })).toBeVisible();
  });

  test("deletes a message and clears a chat", async ({ page }) => {
    // Through the client card: the thread may be empty (the test clears it), then it is not in the dialog list
    await page.goto("/admin/clients");
    await page.getByRole("link", { name: "Иван Кузнецов" }).click();
    await page.getByRole("link", { name: "Написать" }).click();
    await expect(page).toHaveURL(/\/admin\/chat\/[0-9a-f-]{36}$/);
    const text = `Удалите меня, e2e ${Date.now()}`;
    await page.getByRole("textbox", { name: "Сообщение" }).fill(text);
    await page.getByRole("button", { name: "Отправить", exact: true }).click();
    // In the thread itself: the dialog list shows the same text as a preview, sometimes before the thread does.
    // includeHidden: an open menu hides the rest of the page from the accessibility tree
    const thread = page.getByRole("log", { name: "Переписка", includeHidden: true });
    const sent = thread.getByText(text);
    await expect(sent).toBeVisible();

    const row = thread.locator(":scope > div").filter({ hasText: text });
    await row.hover();
    await row.getByRole("button", { name: "Действия с сообщением" }).click();
    await page.getByRole("menuitem", { name: "Удалить сообщение" }).click();
    await expect(sent).toHaveCount(0);
    await page.reload();
    await expect(page.getByText(text)).toHaveCount(0);

    // Something to clear, whatever the thread held before
    const another = `Очистите меня, e2e ${Date.now()}`;
    await page.getByRole("textbox", { name: "Сообщение" }).fill(another);
    await page.getByRole("button", { name: "Отправить", exact: true }).click();
    await expect(thread.getByText(another)).toBeVisible();
    await page.getByRole("button", { name: "Очистить переписку" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Очистить" }).click();
    await expect(page.getByText("Сообщений пока нет")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Сообщений пока нет")).toBeVisible();
  });

  test("completes a chat, finds it in «Завершённые» and by text, brings it back", async ({ page }) => {
    await page.goto("/admin/clients");
    await page.getByRole("link", { name: "Ольга Волкова" }).click();
    await page.getByRole("link", { name: "Написать" }).click();
    await expect(page).toHaveURL(/\/admin\/chat\/[0-9a-f-]{36}$/);
    // A new message makes the chat active, whatever an earlier run left
    const text = `Папки чатов, e2e ${Date.now()}`;
    await page.getByRole("textbox", { name: "Сообщение" }).fill(text);
    await page.getByRole("button", { name: "Отправить", exact: true }).click();
    await expect(page.getByRole("log", { name: "Переписка" }).getByText(text)).toBeVisible();
    await page.reload();

    const list = page.getByRole("complementary");
    const folders = list.getByRole("tablist", { name: "Папки" });
    const dialog = list.getByRole("link", { name: /Ольга Волкова/ });
    await expect(dialog).toBeVisible();
    await page.getByRole("button", { name: "Завершить чат" }).click();
    await expect(page.getByRole("button", { name: "Вернуть в активные" })).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await folders.getByRole("tab", { name: /Завершённые/ }).click();
    await expect(dialog).toBeVisible();

    // Upper case on purpose: the search ignores the case of Cyrillic letters
    await list.getByRole("searchbox", { name: "Поиск по чатам" }).fill(text.toUpperCase());
    await expect(list.locator("mark")).toHaveText(text);
    await expect(list.getByText("Завершён", { exact: true }).first()).toBeVisible();
    await list.getByRole("searchbox", { name: "Поиск по чатам" }).fill("");

    await page.getByRole("button", { name: "Вернуть в активные" }).click();
    await expect(page.getByRole("button", { name: "Завершить чат" })).toBeVisible();
    await folders.getByRole("tab", { name: /Активные/ }).click();
    await expect(dialog).toBeVisible();
  });

  test("owner deletes a client with their account", async ({ page, browser }) => {
    const email = `delete-me-${Date.now()}@example.com`;
    const guest = await browser.newContext();
    const signup = await guest.newPage();
    await signup.goto("/c/demo/register");
    await signup.waitForLoadState("networkidle");
    await signup.getByLabel("Имя и фамилия").fill("Удаляемый Клиент");
    await signup.getByLabel("Email").fill(email);
    await signup.getByLabel("Пароль", { exact: true }).fill("Delete-me-1");
    await signup.getByRole("checkbox", { name: /обработку персональных данных/ }).check();
    await signup.getByRole("button", { name: "Создать аккаунт" }).click();
    await expect(signup).toHaveURL(/\/c\/demo$/);
    await guest.close();

    await page.goto("/admin/clients");
    await page.getByRole("link", { name: "Удаляемый Клиент" }).click();
    await page.getByRole("button", { name: "Удалить" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("Удалить клиента «Удаляемый Клиент»?");
    await page.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();
    await expect(page).toHaveURL(/\/admin\/clients$/);
    await expect(page.getByRole("link", { name: "Удаляемый Клиент" })).toHaveCount(0);

    await page.context().clearCookies();
    await page.goto("/c/demo/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Пароль", { exact: true }).fill("Delete-me-1");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.getByText("Неверный email или пароль")).toBeVisible();
  });

  test("prices page previews a quote as prices change, without saving", async ({ page }) => {
    await page.getByRole("link", { name: "Цены" }).click();
    await expect(page.getByRole("heading", { name: "Пример расчёта" })).toBeVisible();
    const preview = page.getByRole("complementary");
    await expect(preview).toContainText(formatRub(1980)); // banner 3×1 m: 1260 + 16 grommets × 15 + 8 m hem × 60
    await page.getByLabel("Проклейка края, за метр").fill("100");
    await expect(preview).toContainText(formatRub(2300));
    await page.getByLabel("Проклейка края, за метр").fill("-5");
    await expect(page.getByText("Проклейка края, за метр: число от 0")).toBeVisible();
    await expect(page.getByRole("button", { name: "Сохранить цены" })).toBeDisabled();
  });
});
