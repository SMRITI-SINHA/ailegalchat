import { test, expect } from "@playwright/test";

test.describe("Study Buddy smoke tests", () => {
  test("Case Predict AI renders without crash", async ({ page }) => {
    await page.goto("/hub/study/case-predict", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    await expect(page.getByRole("heading", { name: "Case Predict AI" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Coming Soon" })).toBeVisible();
    await expect(page.getByTestId("button-join-waitlist")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("Counter Argument Generator renders without crash", async ({ page }) => {
    await page.goto("/hub/study/counter-args", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    await expect(page.getByRole("heading", { name: "Counter Argument Generator" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Coming Soon" })).toBeVisible();
    await expect(page.getByTestId("button-join-waitlist")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("Legal Sandbox renders without crash", async ({ page }) => {
    await page.goto("/hub/study/sandbox", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    await expect(page.getByRole("heading", { name: "Legal Sandbox" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Coming Soon" })).toBeVisible();
    await expect(page.getByTestId("button-join-waitlist")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });
});
