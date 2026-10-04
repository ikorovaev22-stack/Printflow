import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Demo1234!";
export const CLIENT = "anna@printflow.demo";
export const OWNER = "owner@printflow.demo";
export const CLIENT_STATE = "tests/e2e/.auth/client.json";
export const OWNER_STATE = "tests/e2e/.auth/owner.json";

export async function login(page: Page, path: string, email: string, password = PASSWORD) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}
