import { test, expect } from "@playwright/test";

test.describe("Research — AI Research Assistant", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/hub/research/assistant", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
  });

  test("page renders without crash", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("search input and button are present", async ({ page }) => {
    await expect(page.getByTestId("input-search")).toBeVisible();
    await expect(page.getByTestId("button-search")).toBeVisible();
  });

  test("standard and advanced mode buttons are present", async ({ page }) => {
    await expect(page.getByTestId("button-mode-standard")).toBeVisible();
    await expect(page.getByTestId("button-mode-advanced")).toBeVisible();
  });

  test("entering a query and submitting returns results", async ({ page }) => {
    test.setTimeout(60_000);

    await page.getByTestId("input-search").fill("IPC section 302 murder punishment");
    await page.getByTestId("button-search").click();

    await expect(
      page.locator('[data-testid*="result-"], [data-testid*="card-"]').first().or(
        page.getByText(/Untitled|judgment|act|section|court|found/i).first()
      )
    ).toBeVisible({ timeout: 45_000 });
  });
});

test.describe("Research — Legal Memo Generator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/hub/research/memo", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
  });

  test("page renders without crash", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("generate memo button is visible", async ({ page }) => {
    const btn = page.getByTestId("button-generate-memo").or(
      page.getByTestId("button-generate-first")
    );
    await expect(btn.first()).toBeVisible();
  });

  test("clicking generate opens dialog with required fields", async ({ page }) => {
    const btn = page.getByTestId("button-generate-memo").or(
      page.getByTestId("button-generate-first")
    );
    await btn.first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.getByTestId("textarea-facts")).toBeVisible();
    await expect(page.getByTestId("textarea-issues")).toBeVisible();
    await expect(page.getByTestId("select-structure")).toBeVisible();
  });

  test("memo generation end-to-end flow with IRAC structure", async ({ page }) => {
    test.setTimeout(120_000);

    const btn = page.getByTestId("button-generate-memo").or(
      page.getByTestId("button-generate-first")
    );
    await btn.first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await page.getByTestId("select-structure").click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]').filter({ hasText: "IRAC" }).first().click();
    await page.waitForTimeout(300);

    await page.getByTestId("input-title").fill("Test Memo");
    await page.getByTestId("textarea-facts").fill(
      "Accused was found at the scene with a weapon. Witnesses corroborate. The accused has no alibi."
    );
    await page.getByTestId("textarea-issues").fill(
      "Whether the accused is liable for murder under Section 302 IPC."
    );

    await page.getByTestId("button-generate").click();

    await expect(
      page.locator('[data-testid*="card-memo-"]').first()
    ).toBeVisible({ timeout: 90_000 });
  });
});

test.describe("Research — Compliance Checklist", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/hub/research/compliance", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
  });

  test("page renders without crash", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("industry, jurisdiction and activity selectors are present", async ({ page }) => {
    await expect(page.getByTestId("select-industry")).toBeVisible();
    await expect(page.getByTestId("select-jurisdiction")).toBeVisible();
    await expect(page.getByTestId("select-activity")).toBeVisible();
  });

  test("generate button is present", async ({ page }) => {
    await expect(page.getByTestId("button-generate")).toBeVisible();
  });

  test("compliance checklist generation flow", async ({ page }) => {
    test.setTimeout(120_000);

    await page.getByTestId("select-industry").click();
    await page.waitForTimeout(500);
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(300);

    await page.getByTestId("select-jurisdiction").click();
    await page.waitForTimeout(500);
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(300);

    await page.getByTestId("select-activity").click();
    await page.waitForTimeout(500);
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(300);

    await page.getByTestId("button-generate").click();

    await expect(
      page.locator('[data-testid*="checklist-item-"]').first().or(
        page.getByText(/compliance|requirement|obligation/i).first()
      )
    ).toBeVisible({ timeout: 90_000 });
  });
});

test.describe("Research — Saved Notes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/hub/research/notes", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
  });

  test("page renders without crash", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText("Something went wrong");
  });

  test("Saved Notes heading is visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Saved Notes" })).toBeVisible();
  });

  test("Create Note button is present", async ({ page }) => {
    await expect(page.getByTestId("button-create-note")).toBeVisible();
  });

  test("search input is present", async ({ page }) => {
    await expect(page.getByTestId("input-search-notes")).toBeVisible();
  });

  test("notes list renders — empty state or populated", async ({ page }) => {
    await page.waitForTimeout(1500);
    const notesOrEmpty = page.locator('[data-testid*="note-item-"]').first().or(
      page.getByText(/no saved notes yet|no notes match/i).first()
    );
    await expect(notesOrEmpty).toBeVisible({ timeout: 10_000 });
  });

  test("create a note and verify it appears", async ({ page }) => {
    await page.getByTestId("button-create-note").click();
    await page.waitForTimeout(400);

    await expect(page.locator('[role="dialog"]')).toBeVisible();

    const title = `E2E Note ${Date.now()}`;
    await page.getByTestId("input-new-note-name").fill(title);
    await page.getByTestId("textarea-new-note-content").fill(
      "This is a test note created by Playwright E2E tests."
    );

    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/research/notes") && r.request().method() === "POST",
      { timeout: 10_000 }
    );
    await page.locator('[role="dialog"] button').filter({ hasText: /create note/i }).click();
    await responsePromise;
    await page.waitForTimeout(1_000);

    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
  });
});
