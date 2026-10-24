import { test } from "@playwright/test";

// Authenticated happy path: deposit → upload → scan → verify → release.
// SKIPPED until the Auth0 tenant is wired (see README "Auth0 setup"): the
// specs below need a real depositor/agent/beneficiary session. They are
// committed as documentation of intent — enable by removing .skip and
// providing E2E_AUTH_* credentials via Auth0 password grant in a global
// setup that stores signed-in storage states per role.
test.describe.skip("authenticated escrow lifecycle", () => {
  test("depositor creates a draft, uploads, and activates", async () => {
    // TODO(auth0): sign in as depositor@demo.test → /portal/deposits/new →
    // create draft → upload 3 typed files via the presigned flow → run the
    // scan worker → assert SCAN PASS → activate → assert ACTIVE.
  });

  test("agent verifies through Certified with human sign-off", async () => {
    // TODO(auth0): sign in as agent@demo.test → escalate VALIDATED →
    // execute → escalate VERIFIED → execute → escalate CERTIFIED → execute
    // (RUNNING) → approve with note → assert certificate issued.
  });

  test("beneficiary claims, vendor disputes, second agent decides", async () => {
    // TODO(auth0): beneficiary files SUPPORT_FAILURE claim → agent-1
    // notifies → depositor disputes → agent-1 decision 409s (maker-checker)
    // → agent-2 approves → delivery recorded → assert DELIVERED.
  });

  test("role gates deny cross-role actions in the UI", async () => {
    // TODO(auth0): beneficiary sees no "New deposit" affordance path to
    // success (action 403s); auditor opening /portal/releases/new gets the
    // decisions blocked. Assert on the problem-details responses.
  });
});
