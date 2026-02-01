import { expect, test } from "@playwright/test";

async function ensureClassicMode(page: Parameters<typeof test>[0]["page"]) {
  const dialog = page.getByRole("dialog", { name: /选择使用方式|Choose how to start/i });
  if (await dialog.isVisible()) {
    await page.getByRole("button", { name: /经典模式|Classic mode/i }).click();
    await expect(dialog).toBeHidden();
  }
}

test("app boots and shows navigation", async ({ page }) => {
  await page.goto("/");
  await ensureClassicMode(page);
  const navLink = page.getByRole("link", { name: /图书馆|Library/i });
  await expect(navLink).toBeVisible();
});

test("can navigate to chat page", async ({ page }) => {
  await page.goto("/");
  await ensureClassicMode(page);
  await page.getByRole("link", { name: /聊天|Chat/i }).click();
  await expect(page).toHaveURL(/#\/chat/);
});
