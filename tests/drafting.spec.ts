import { test, expect } from "@playwright/test";

test.describe("Drafting — AI Legal Drafting", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/hub/drafting/ai", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
  });

  test("page renders without crash", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("generate draft button is visible", async ({ page }) => {
    const btn = page.getByTestId("button-generate-draft").or(
      page.getByTestId("button-generate-first")
    );
    await expect(btn.first()).toBeVisible({ timeout: 10_000 });
  });

  test("clicking generate opens start-option dialog", async ({ page }) => {
    const btn = page.getByTestId("button-generate-draft").or(
      page.getByTestId("button-generate-first")
    );
    await btn.first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.getByTestId("card-type-facts")).toBeVisible();
    await expect(page.getByTestId("card-upload-reference")).toBeVisible();
    await expect(page.getByTestId("card-upload-draft")).toBeVisible();
  });

  test("type-facts flow: fill form fields and trigger draft generation", async ({ page }) => {
    const btn = page.getByTestId("button-generate-draft").or(
      page.getByTestId("button-generate-first")
    );
    await btn.first().click();
    await page.waitForTimeout(500);

    await page.getByTestId("card-type-facts").click();
    await page.waitForTimeout(600);

    await expect(page.getByTestId("select-doc-category")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("select-doc-category").click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(400);

    await page.getByTestId("select-doc-subtype").click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(300);

    await page.getByTestId("input-title").fill("Test Bail Petition");
    await page.getByTestId("input-parties").fill("Ram Prasad vs State of Maharashtra");

    await page.getByTestId("select-jurisdiction").click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(300);

    const facts =
      "Accused was arrested on 01-Jan-2024 under Section 302 IPC. No prior criminal record. " +
      "Family is dependent on accused. Investigation is complete and chargesheet has been filed. " +
      "Witnesses confirm the accused was not at the scene at the time of the offence.";
    await page.getByTestId("textarea-facts").fill(facts);
    await page.waitForTimeout(500);

    const generateBtn = page.getByTestId("button-generate");
    await expect(generateBtn).toBeEnabled({ timeout: 5_000 });

    await generateBtn.click();
    await page.waitForTimeout(1_000);

    await expect(generateBtn).toContainText(/Generating/i);
  });
});

test.describe("Drafting — Empty Document", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/hub/drafting/empty", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
  });

  test("page renders without crash", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("rich-text editor loads", async ({ page }) => {
    await expect(page.getByTestId("editor-content")).toBeVisible();
  });

  test("document title input is present", async ({ page }) => {
    await expect(page.getByTestId("input-doc-title")).toBeVisible();
  });

  test("typing text appears in editor", async ({ page }) => {
    const editor = page.getByTestId("editor-content");
    await editor.click();
    await page.keyboard.type("Test legal document content");
    await expect(editor).toContainText("Test legal document content");
  });
});

test.describe("Drafting — Custom Drafting", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/hub/drafting/custom", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
  });

  test("page renders without crash", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("generate custom draft button is visible", async ({ page }) => {
    const btn = page.getByTestId("button-generate-custom").or(
      page.getByTestId("button-generate-first")
    );
    await expect(btn.first()).toBeVisible();
  });

  test("clicking generate opens dialog with form fields", async ({ page }) => {
    const btn = page.getByTestId("button-generate-custom").or(
      page.getByTestId("button-generate-first")
    );
    await btn.first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.getByTestId("input-title")).toBeVisible();
    await expect(page.getByTestId("textarea-facts")).toBeVisible();
  });
});

test.describe("Drafting — Train Your Drafts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/hub/drafting/train", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
  });

  test("page renders without crash", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("Train Your Drafts heading is visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Train Your Drafts" })).toBeVisible();
  });

  test("upload area and training description are visible", async ({ page }) => {
    await expect(page.getByTestId("dropzone-upload")).toBeVisible();
    await expect(page.getByText(/SOP|playbooks|drafts/i).first()).toBeVisible();
  });
});
