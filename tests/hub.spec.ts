import { test, expect } from "@playwright/test";

test.describe("Hub home page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/hub", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
  });

  test("renders page title and heading", async ({ page }) => {
    await expect(page.getByText("Chakshi AI Hub")).toBeVisible();
    await expect(page.getByText("Your complete legal AI workspace")).toBeVisible();
  });

  test("renders all section headings", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Drafting", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI Chat", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Research", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Study Buddy", exact: true })).toBeVisible();
  });

  test("renders all Drafting tiles", async ({ page }) => {
    await expect(page.getByTestId("card-hub-ai-legal-drafting")).toBeVisible();
    await expect(page.getByTestId("card-hub-empty-document")).toBeVisible();
    await expect(page.getByTestId("card-hub-custom-drafting")).toBeVisible();
    await expect(page.getByTestId("card-hub-train-your-drafts")).toBeVisible();
  });

  test("renders all AI Chat tiles", async ({ page }) => {
    await expect(page.getByTestId("card-hub-cnr-chatbot")).toBeVisible();
    await expect(page.getByTestId("card-hub-docuchat")).toBeVisible();
    await expect(page.getByTestId("card-hub-nyaya-ai")).toBeVisible();
  });

  test("renders all Research tiles", async ({ page }) => {
    await expect(page.getByTestId("card-hub-ai-research-assistant")).toBeVisible();
    await expect(page.getByTestId("card-hub-legal-memo-generator")).toBeVisible();
    await expect(page.getByTestId("card-hub-compliance-checklist")).toBeVisible();
    await expect(page.getByTestId("card-hub-saved-notes")).toBeVisible();
  });

  test("renders all Study Buddy tiles", async ({ page }) => {
    await expect(page.getByTestId("card-hub-case-predict-ai")).toBeVisible();
    await expect(page.getByTestId("card-hub-counter-arguments")).toBeVisible();
    await expect(page.getByTestId("card-hub-legal-sandbox")).toBeVisible();
  });

  test("AI Legal Drafting tile navigates to /hub/drafting/ai", async ({ page }) => {
    await page.getByTestId("card-hub-ai-legal-drafting").click();
    await expect(page).toHaveURL(/\/hub\/drafting\/ai/, { timeout: 10_000 });
  });

  test("DocuChat tile navigates to /hub/chat/pdf", async ({ page }) => {
    await page.getByTestId("card-hub-docuchat").click();
    await expect(page).toHaveURL(/\/hub\/chat\/pdf/, { timeout: 10_000 });
  });

  test("Nyaya AI tile navigates to /hub/chat/nyaya", async ({ page }) => {
    await page.getByTestId("card-hub-nyaya-ai").click();
    await expect(page).toHaveURL(/\/hub\/chat\/nyaya/, { timeout: 10_000 });
  });

  test("CNR Chatbot tile navigates to /hub/chat/cnr", async ({ page }) => {
    await page.getByTestId("card-hub-cnr-chatbot").click();
    await expect(page).toHaveURL(/\/hub\/chat\/cnr/, { timeout: 10_000 });
  });

  test("AI Research Assistant tile navigates to /hub/research/assistant", async ({ page }) => {
    await page.getByTestId("card-hub-ai-research-assistant").click();
    await expect(page).toHaveURL(/\/hub\/research\/assistant/, { timeout: 10_000 });
  });

  test("Legal Memo Generator tile navigates to /hub/research/memo", async ({ page }) => {
    await page.getByTestId("card-hub-legal-memo-generator").click();
    await expect(page).toHaveURL(/\/hub\/research\/memo/, { timeout: 10_000 });
  });

  test("Compliance Checklist tile navigates to /hub/research/compliance", async ({ page }) => {
    await page.getByTestId("card-hub-compliance-checklist").click();
    await expect(page).toHaveURL(/\/hub\/research\/compliance/, { timeout: 10_000 });
  });

  test("Saved Notes tile navigates to /hub/research/notes", async ({ page }) => {
    await page.getByTestId("card-hub-saved-notes").click();
    await expect(page).toHaveURL(/\/hub\/research\/notes/, { timeout: 10_000 });
  });

  test("Case Predict AI tile navigates to /hub/study/case-predict", async ({ page }) => {
    await page.getByTestId("card-hub-case-predict-ai").click();
    await expect(page).toHaveURL(/\/hub\/study\/case-predict/, { timeout: 10_000 });
  });

  test("Counter Arguments tile navigates to /hub/study/counter-args", async ({ page }) => {
    await page.getByTestId("card-hub-counter-arguments").click();
    await expect(page).toHaveURL(/\/hub\/study\/counter-args/, { timeout: 10_000 });
  });

  test("Legal Sandbox tile navigates to /hub/study/sandbox", async ({ page }) => {
    await page.getByTestId("card-hub-legal-sandbox").click();
    await expect(page).toHaveURL(/\/hub\/study\/sandbox/, { timeout: 10_000 });
  });
});
