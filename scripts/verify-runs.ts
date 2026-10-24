// Executes queued verification runs (automated tiers finish terminally;
// CERTIFIED parks in RUNNING for the human sign-off in the portal).
// Local dev: tsx --env-file=.env scripts/verify-runs.ts [--once]
// Production: scheduled job invoking the same executeQueuedRuns() service.
// Usage: pnpm worker:verify [--once]
import { setTimeout as sleep } from "node:timers/promises";
import { executeQueuedRuns } from "../src/services/verification";

const once = process.argv.includes("--once");

async function main(): Promise<void> {
  const summary = await executeQueuedRuns();
  console.log(
    `verify pass: executed=${summary.executed} passed=${summary.passed} failed=${summary.failed} awaitingReview=${summary.awaitingReview}`,
  );
  if (once) return;
  console.log("Watching the queue every 15s — Ctrl+C to stop.");
  while (true) {
    await sleep(15_000);
    try {
      const next = await executeQueuedRuns();
      if (next.executed > 0) {
        console.log(
          `verify pass: executed=${next.executed} passed=${next.passed} failed=${next.failed} awaitingReview=${next.awaitingReview}`,
        );
      }
    } catch (error) {
      console.error("verify pass failed:", error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
