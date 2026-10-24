import { expect, test } from "@playwright/test";

// Public surface + auth gates. Runs without Auth0: every protected route must
// bounce to sign-in, every protected API must answer 401 with a stable code,
// and the public certificate pages must behave. Requires a migrated + seeded
// database (pnpm db:migrate && pnpm db:seed) and the compose stack up.

test("landing page renders", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
});

for (const path of [
  "/portal",
  "/portal/deposits",
  "/portal/deposits/new",
  "/portal/verification",
  "/portal/releases",
  "/portal/audit",
]) {
  test(`${path} bounces cookie-less visitors to sign-in`, async ({ request }) => {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const location = res.headers()["location"] ?? "";
    expect(location).toContain("/api/auth/signin");
    expect(location).toContain(encodeURIComponent(path));
  });
}

test("GraphQL endpoint describes itself on GET", async ({ request }) => {
  const res = await request.get("/api/graphql");
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ service: "escrow-vault-graphql" });
});

test("GraphQL rejects anonymous POSTs with UNAUTHENTICATED", async ({ request }) => {
  const res = await request.post("/api/graphql", {
    data: { query: "{ deposits { id } }" },
  });
  expect(res.status()).toBe(401);
  expect(await res.json()).toMatchObject({
    error: { code: "UNAUTHENTICATED" },
  });
});

test("upload signer rejects anonymous POSTs with 401", async ({ request }) => {
  const res = await request.post("/api/uploads/sign", { data: {} });
  expect(res.status()).toBe(401);
});

test("seeded certificate lookup renders publicly", async ({ page }) => {
  await page.goto("/verify/CERT-2026-0001");
  await expect(page.getByRole("heading", { name: "CERT-2026-0001" })).toBeVisible();
  await expect(page.getByText("Acme Software BV")).toBeVisible();
});

test("unknown certificate serial shows the 404 page", async ({ page }) => {
  await page.goto("/verify/NOPE-0000");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
});
