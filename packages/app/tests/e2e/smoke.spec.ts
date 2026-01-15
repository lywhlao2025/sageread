import { expect, test } from "@playwright/test";

test("app boots and shows navigation", async ({ page }) => {
  await page.goto("/");
  const navLink = page.getByRole("link", { name: /图书馆|Library/i });
  await expect(navLink).toBeVisible();
});

test("can navigate to chat page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /聊天|Chat/i }).click();
  await expect(page).toHaveURL(/#\/chat/);
});
