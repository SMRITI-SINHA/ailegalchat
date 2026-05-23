import { test, expect } from "@playwright/test";

test.describe("Nyaya AI chat", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/hub/chat/nyaya", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
  });

  test("page renders without crash", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("chat input and send button are visible on page load", async ({ page }) => {
    await expect(page.getByTestId("input-nyaya")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("button-send")).toBeVisible({ timeout: 10_000 });
  });

  test("sample questions (LexAI widget) render on empty state", async ({ page }) => {
    const firstSample = page.getByTestId("card-sample-0");
    await expect(firstSample).toBeVisible({ timeout: 10_000 });
    const secondSample = page.getByTestId("card-sample-1");
    await expect(secondSample).toBeVisible({ timeout: 5_000 });
  });

  test("history panel opens and shows new-chat button", async ({ page }) => {
    await expect(page.getByTestId("button-history")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("button-history").click();
    await expect(page.getByTestId("button-new-chat")).toBeVisible({ timeout: 5_000 });
  });

  test("attach-file and voice controls are present", async ({ page }) => {
    await expect(page.getByTestId("button-attach-file")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("button-enable-voice")).toBeVisible({ timeout: 10_000 });
  });

  test("submit a legal question and receive a non-empty response", async ({ page }) => {
    test.setTimeout(120_000);

    const chatInput = page.getByTestId("input-nyaya");
    await expect(chatInput).toBeVisible({ timeout: 10_000 });
    await chatInput.fill("What is Section 420 of the Indian Penal Code?");

    await page.getByTestId("button-send").click();
    await page.waitForTimeout(2_000);

    const assistantCard = page.locator(".flex.items-center.gap-2 >> text=Nyaya AI").first();
    const assistantMessage = page.locator('[class*="space-y-6"] > div').filter({ hasNot: page.locator('[class*="justify-end"]') }).first();

    await expect(
      assistantCard.or(assistantMessage)
    ).toBeVisible({ timeout: 90_000 });
  });
});
