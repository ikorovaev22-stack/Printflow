import { expect, test, type Page } from "@playwright/test";
import { formatRub } from "../../src/lib/format";
import { DEFAULT_PRICE_LIST, quote, type BannersInput, type CalcInput, type CardsInput, type ItemInput } from "../../src/lib/pricing";
import { CLIENT, CLIENT_STATE, OWNER_STATE, PASSWORD } from "./helpers";

// The demo company uses the default price list (npm run seed), so the expected sums come from the same function
const total = (input: CalcInput) => formatRub(quote(input, DEFAULT_PRICE_LIST).total);
const choose = (page: Page, group: string, option: string) =>
  page.getByRole("radiogroup", { name: group }).getByText(option, { exact: true }).click();
const shownTotal = (page: Page) => page.getByRole("region", { name: "Итог расчёта" }).locator("[aria-live]");

test("a guest calculates without an account and comes back to the same options after signing in", async ({ page }) => {
  await page.goto("/c/artproject/login");
  await page.getByRole("link", { name: "Рассчитать стоимость без входа" }).click();
  await expect(page.getByRole("heading", { name: "Расчёт стоимости" })).toBeVisible();

  await choose(page, "Что печатаем", "Баннеры");
  await page.getByLabel("Ширина", { exact: true }).fill("2,5");
  await choose(page, "Материал", "Блэкаут");
  const banner: BannersInput = {
    product: "banners", width: 2.5, height: 1, material: "blackout", grommets: 50, hem: true, pockets: "none", urgent: false,
  };
  await expect(shownTotal(page)).toHaveText(total(banner));

  await page.getByRole("link", { name: "Войти и оформить" }).click();
  await expect(page).toHaveURL(/\/c\/artproject\/login\?next=/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(CLIENT);
  await page.getByLabel("Пароль", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(page).toHaveURL(/\/c\/artproject\/calculator\?p=banners&w=2\.5&h=1&mat=blackout/);
  await expect(shownTotal(page)).toHaveText(total(banner));
  await expect(page.getByRole("button", { name: "Оформить заказ" })).toBeVisible();
});

test.describe("signed-in client", () => {
  test.use({ storageState: CLIENT_STATE });

  test("orders business cards at the calculated price; the request reaches the panel", async ({ page, browser }) => {
    await page.goto("/c/artproject");
    await page.getByRole("link", { name: /Рассчитать стоимость/ }).click();

    await choose(page, "Тираж", "500");
    await choose(page, "Бумага", "Дизайнерская");
    await choose(page, "Печать", "Двусторонняя (4+4)");
    await choose(page, "Ламинация", "Матовая");
    await page.getByLabel("Срочно, +50%").click();
    const cards: CardsInput = {
      product: "cards", size: "90x50", qty: 500, paper: "designer", sides: "4+4", lamination: "matte", corners: false, urgent: true,
    };
    const sum = total(cards);
    await expect(shownTotal(page)).toHaveText(sum);

    await page.getByRole("button", { name: "Из чего складывается цена" }).click();
    await expect(page.getByText("Ламинация матовая")).toBeVisible();
    await expect(page.getByText("Срочность +50%")).toBeVisible();

    const comment = `Нужны к пятнице, e2e ${Date.now()}`;
    await page.getByLabel("Комментарий для менеджера").fill(comment);
    await page.getByRole("button", { name: "Оформить заказ" }).click();

    await expect(page).toHaveURL(/\/c\/artproject\/orders\/[0-9a-f-]{36}$/);
    const orderId = page.url().split("/").pop();
    await expect(page.getByRole("heading", { name: "Визитки 90×50 мм, 500 шт." })).toBeVisible();
    await expect(page.getByText(sum).first()).toBeVisible();
    await expect(page.getByText(comment)).toBeVisible();

    const staff = await browser.newContext({ storageState: OWNER_STATE });
    const admin = await staff.newPage();
    await admin.goto("/admin/orders");
    await expect(admin.getByRole("row").filter({ hasText: "Визитки 90×50 мм, 500 шт." }).filter({ hasText: sum }).first()).toContainText("Заявка");
    await admin.goto(`/admin/orders/${orderId}`);
    await expect(admin.getByRole("heading", { name: "Расчёт клиента" })).toBeVisible();
    await expect(admin.getByText("Срочность +50%")).toBeVisible();
    await expect(admin.locator("input[name=price]")).toHaveValue(String(quote(cards, DEFAULT_PRICE_LIST).total));
    await staff.close();
  });

  test("orders an own item with a layout attached; the file lands in the order", async ({ page }) => {
    await page.goto("/c/artproject/calculator");
    await choose(page, "Что печатаем", "Листовки А5");
    await choose(page, "Тираж", "500");
    await choose(page, "Печать", "Двусторонняя (4+4)");
    const flyers: ItemInput = { product: "item", item: "flyers", qty: 500, options: { paper: "c130", sides: "s44" }, extras: [], urgent: false };
    await expect(shownTotal(page)).toHaveText(total(flyers));

    await page.getByLabel("Файлы макета").setInputFiles({ name: "maket.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.3\n%%EOF\n") });
    await expect(page.getByText("maket.pdf")).toBeVisible();
    await page.getByRole("button", { name: "Оформить заказ" }).click();

    await expect(page).toHaveURL(/\/c\/artproject\/orders\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Листовки А5, 500 шт." })).toBeVisible();
    await expect(page.getByText("maket.pdf")).toBeVisible();
  });
});
