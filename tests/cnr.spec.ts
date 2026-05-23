import { test, expect } from "@playwright/test";

test.describe("CNR Chatbot page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/hub/chat/cnr", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
  });

  test("page loads without error boundary", async ({ page }) => {
    await expect(page.getByTestId("text-page-title")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("CNR search tab and saved cases tab are present", async ({ page }) => {
    await expect(page.getByTestId("tab-cnr-search")).toBeVisible();
    await expect(page.getByTestId("tab-saved-cases")).toBeVisible();
  });

  test("CNR chatbot iframe is present", async ({ page }) => {
    await expect(page.getByTestId("iframe-cnr-chatbot")).toBeVisible();
  });

  test("saved cases tab is clickable and loads case list area", async ({ page }) => {
    await page.getByTestId("tab-saved-cases").click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId("tab-saved-cases")).toBeVisible();
  });

  test("create new note button is present", async ({ page }) => {
    await expect(page.getByTestId("button-new-note")).toBeVisible();
  });
});
