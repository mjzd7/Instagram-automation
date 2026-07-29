/**
 * scripts/post-workflow.ts — Composio CLI workflow entry point.
 *
 * This file is run by: composio run --file scripts/post-workflow.ts
 * No top-level exports (composio runs via Bun in script mode).
 * Imports main() from daily-quote and executes it.
 */
import { main } from "../dist/daily-quote.js";

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("Workflow failed:", msg);
  process.exit(1);
});
