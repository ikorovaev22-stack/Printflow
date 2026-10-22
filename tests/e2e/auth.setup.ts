import { mkdirSync } from "node:fs";
import { test as setup } from "@playwright/test";
import { CLIENT, CLIENT_STATE, OWNER, OWNER_STATE, login } from "./helpers";

mkdirSync("tests/e2e/.auth", { recursive: true });

setup("sign in as the demo client", async ({ page }) => {
  await login(page, "/c/artproject/login", CLIENT);
  await page.context().storageState({ path: CLIENT_STATE });
});

setup("sign in as the demo owner", async ({ page }) => {
  await login(page, "/admin/login", OWNER);
  await page.context().storageState({ path: OWNER_STATE });
});
