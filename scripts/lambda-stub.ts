// Local stand-in for aws/lambda/deposit-scan (M3): polls the deposit bucket
// via scanPendingAssets() and exits. The real Lambda will invoke the same
// service on s3:ObjectCreated events.
// Usage: tsx --env-file=.env scripts/lambda-stub.ts [--once] [--interval-ms N]
import { setTimeout as sleep } from "node:timers/promises";
import { scanPendingAssets } from "../src/services/scan";

const once = process.argv.includes("--once");
const intervalFlag = process.argv.indexOf("--interval-ms");
const intervalMs =
  intervalFlag >= 0 ? Number(process.argv[intervalFlag + 1]) || 10_000 : 10_000;

async function pass(label: string): Promise<boolean> {
  const summary = await scanPendingAssets();
  console.log(
    `[${label}] scan pass: checked=${summary.checked} passed=${summary.passed} failed=${summary.failed} runsCreated=${summary.runsCreated}`,
  );
  return summary.checked > 0;
}

async function main(): Promise<void> {
  if (once) {
    await pass("once");
    return;
  }
  console.log(`Polling every ${intervalMs}ms — Ctrl+C to stop.`);
  while (true) {
    try {
      await pass(new Date().toISOString());
    } catch (error) {
      console.error("scan pass failed:", error);
    }
    await sleep(intervalMs);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
