import { test, expect } from "@playwright/test";

test.describe("API smoke tests (dev bypass — no token required)", () => {
  test("GET /api/chat/sessions returns 200", async ({ request }) => {
    const res = await request.get("/api/chat/sessions");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("GET /api/documents returns 200", async ({ request }) => {
    const res = await request.get("/api/documents");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("GET /api/research/notes returns 200", async ({ request }) => {
    const res = await request.get("/api/research/notes");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test("GET /api/stats returns 200", async ({ request }) => {
    const res = await request.get("/api/stats");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });
});
