// Fails CI when the gzipped JavaScript in dist/assets exceeds the budget set in the v2 redesign.
// No dependencies: zlib ships with Node.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_KB = Number(process.env.JS_BUDGET_KB ?? 180);
const dir = "dist/assets";
const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
if (files.length === 0) {
  console.error(`No .js files in ${dir}. Run npm run build first.`);
  process.exit(1);
}
let total = 0;
for (const f of files) {
  const kb = gzipSync(readFileSync(join(dir, f))).length / 1024;
  total += kb;
  console.log(`${f.padEnd(40)} ${kb.toFixed(1).padStart(7)} KB gzip`);
}
console.log(`Total ${total.toFixed(1)} KB gzip (budget ${BUDGET_KB} KB)`);
if (total > BUDGET_KB) {
  console.error(`Over budget by ${(total - BUDGET_KB).toFixed(1)} KB. Trim dependencies or lazy load before merging.`);
  process.exit(1);
}
