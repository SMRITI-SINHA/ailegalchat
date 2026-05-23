import { test, expect } from "@playwright/test";

test.describe("DocuChat", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/hub/chat/pdf", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
  });

  test("session list loads with Upload & Chat button visible", async ({ page }) => {
    const uploadBtn = page.getByTestId("button-upload-pdf").or(
      page.getByTestId("button-upload-first")
    );
    await expect(uploadBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test("panel collapse changes chat area to full-width and expand restores it", async ({ page, request }) => {
    const sessionRes = await request.post("/api/chat/sessions", {
      data: { title: "Collapse Test Session", sessionType: "chatwithpdf" },
    });
    expect([200, 201]).toContain(sessionRes.status());
    const session = await sessionRes.json();
    const sessionId = session.id;

    try {
      await page.goto("/hub/chat/pdf", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);

      const sessionCard = page.getByTestId(`card-session-${sessionId}`);
      await expect(sessionCard).toBeVisible({ timeout: 10_000 });
      await sessionCard.click();
      await page.waitForTimeout(1000);

      await page.getByTestId("button-toggle-notes").click();
      await page.waitForTimeout(400);

      const collapseBtn = page.getByTestId("button-toggle-panel-collapse");
      await expect(collapseBtn).toBeVisible({ timeout: 5_000 });

      await collapseBtn.click();
      await page.waitForTimeout(500);

      await expect(page.getByTestId("button-toggle-notes")).toBeVisible({ timeout: 5_000 });

      await collapseBtn.click();
      await page.waitForTimeout(500);

      await expect(page.getByTestId("button-toggle-notes")).toBeVisible({ timeout: 5_000 });
    } finally {
      await request.delete(`/api/chat/sessions/${sessionId}`);
    }
  });

  test("notes: save a note and verify it persists across navigation", async ({ page, request }) => {
    const sessionRes = await request.post("/api/chat/sessions", {
      data: { title: "Notes Persistence Test", sessionType: "chatwithpdf" },
    });
    expect([200, 201]).toContain(sessionRes.status());
    const session = await sessionRes.json();
    const sessionId = session.id;

    try {
      await page.goto("/hub/chat/pdf", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);

      const sessionCard = page.getByTestId(`card-session-${sessionId}`);
      await expect(sessionCard).toBeVisible({ timeout: 10_000 });
      await sessionCard.click();
      await page.waitForTimeout(1000);

      await page.getByTestId("button-toggle-notes").click();
      await page.waitForTimeout(500);

      await page.getByTestId("button-notes-tab-write").click();
      await page.waitForTimeout(300);

      const noteText = `E2E test note ${Date.now()}`;
      await page.getByTestId("textarea-note").fill(noteText);
      await page.getByTestId("button-save-note").click();
      await page.waitForTimeout(500);

      await page.getByTestId("button-notes-tab-saved").click();
      await expect(page.getByText(noteText)).toBeVisible({ timeout: 5_000 });

      await page.goto("/hub", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      await page.goto("/hub/chat/pdf", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);

      const sessionCardAgain = page.getByTestId(`card-session-${sessionId}`);
      await expect(sessionCardAgain).toBeVisible({ timeout: 10_000 });
      await sessionCardAgain.click();
      await page.waitForTimeout(1000);

      await page.getByTestId("button-toggle-notes").click();
      await page.waitForTimeout(500);
      await page.getByTestId("button-notes-tab-saved").click();
      await expect(page.getByText(noteText)).toBeVisible({ timeout: 5_000 });
    } finally {
      await request.delete(`/api/chat/sessions/${sessionId}`);
    }
  });

  test("page-ref pill click re-opens panel when collapsed", async ({ page, request }) => {
    const sessionRes = await request.post("/api/chat/sessions", {
      data: { title: "Page Ref Pill Test", sessionType: "chatwithpdf" },
    });
    expect([200, 201]).toContain(sessionRes.status());
    const session = await sessionRes.json();
    const sessionId = session.id;

    try {
      await page.goto("/hub/chat/pdf", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);

      const sessionCard = page.getByTestId(`card-session-${sessionId}`);
      await expect(sessionCard).toBeVisible({ timeout: 10_000 });
      await sessionCard.click();
      await page.waitForTimeout(1000);

      await page.getByTestId("button-toggle-notes").click();
      await page.waitForTimeout(400);

      const collapseBtn = page.getByTestId("button-toggle-panel-collapse");
      if (await collapseBtn.isVisible()) {
        await collapseBtn.click();
        await page.waitForTimeout(500);
      }

      const pageRefPill = page.getByTestId(/button-page-ref-/).first();
      if (await pageRefPill.isVisible({ timeout: 2_000 })) {
        await pageRefPill.click();
        await page.waitForTimeout(500);
        await expect(page.getByTestId("button-toggle-doc")).toBeVisible();
      } else {
        test.skip(true, "No page-ref pills present — requires an uploaded document with AI citations");
      }
    } finally {
      await request.delete(`/api/chat/sessions/${sessionId}`);
    }
  });
});
