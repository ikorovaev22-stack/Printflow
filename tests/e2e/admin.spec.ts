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
