import { expect, test } from "@playwright/test";
import { CLIENT, CLIENT_STATE } from "./helpers";

test("without a session the client app asks to sign in", async ({ page }) => {
  await page.goto("/c/demo");
  await expect(page).toHaveURL(/\/c\/demo\/login$/);
  await expect(page.getByRole("heading", { name: "С возвращением" })).toBeVisible();
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/c/demo/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(CLIENT);
  await page.getByLabel("Пароль", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByText("Неверный email или пароль")).toBeVisible();
});

test("forgot password answers the same for any address", async ({ page }) => {
  await page.goto("/c/demo/login");
  await page.getByRole("link", { name: "Забыли пароль?" }).click();
  await expect(page).toHaveURL(/\/auth\/forgot\?slug=demo$/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(`nobody-${Date.now()}@example.com`);
  await page.getByRole("button", { name: "Прислать ссылку" }).click();
  await expect(page.getByText("Если такой email зарегистрирован")).toBeVisible();
});

test("sign-up needs consent to personal data processing", async ({ page }) => {
  await page.goto("/c/demo/register");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Имя и фамилия").fill("Новый Клиент");
  await page.getByLabel("Email").fill(`new-${Date.now()}@example.com`);
  await page.getByLabel("Пароль", { exact: true }).fill("New-client-1");
  const consent = page.getByRole("checkbox", { name: /обработку персональных данных/ });
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  // The browser blocks the form until the box is ticked
  await expect(page).toHaveURL(/\/register$/);
  expect(await consent.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);

  const policy = page.waitForEvent("popup");
  await page.getByRole("link", { name: "политикой конфиденциальности" }).click();
  await expect((await policy).getByRole("heading", { name: "Политика конфиденциальности" })).toBeVisible();

  await consent.check();
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await expect(page).toHaveURL(/\/c\/demo$/);
  await expect(page.getByRole("heading", { name: "Ваши заказы" })).toBeVisible();
});

test.describe("signed-in client", () => {
  test.use({ storageState: CLIENT_STATE });
  test.beforeEach(({ page }) => page.goto("/c/demo"));

  test("sees orders and the stage history of an order", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Ваши заказы" })).toBeVisible();
    await page.getByRole("link", { name: /Каталог продукции/ }).first().click();
    await expect(page.getByRole("heading", { name: "Каталог продукции, 40 стр." })).toBeVisible();
    const steps = page.locator("ol li");
    await expect(steps).toHaveCount(6);
    await expect(steps.first()).toContainText(/\d{1,2} [а-я]+\.?, \d{2}:\d{2}/);
  });

  test("attaches a layout to an order", async ({ page }) => {
    await page.getByRole("link", { name: /Каталог продукции/ }).first().click();
    const name = `layout-${Date.now()}.pdf`;
    await page.locator("input[type=file]").setInputFiles({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 e2e") });
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  });

  test("sends a chat message", async ({ page }) => {
    await page.getByRole("link", { name: "Чат", exact: true }).click();
    const text = `E2E ${Date.now()}`;
    await page.getByLabel("Сообщение").fill(text);
    await page.getByRole("button", { name: "Отправить" }).click();
    await expect(page.getByText(text)).toBeVisible();
  });

  test("switches the theme", async ({ page }) => {
    await page.goto("/c/demo/profile");
    await page.getByRole("radio", { name: "Тёмная" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("radio", { name: "Как в системе" }).click();
  });
});
