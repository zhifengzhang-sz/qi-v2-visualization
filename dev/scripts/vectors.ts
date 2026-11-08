// The contract's vectors in the chart app's input form (make vectors; docs/designs/design-chart-chanlun-3-2026-11-09.md,
// The chart app): `bun vectors.ts DIR`, in the project's shell, which names chanlun's vectors at the tag the flake pins
// (CHANLUN_VECTORS). Writes DIR/bars.csv, the 4,000 bars the vectors' bars.ts makes up (not of any market), each its
// time a UTC minute, its prices and volume as bars.ts writes them; DIR/request.json, their scale and source; and
// DIR/run.json, the vectors' run.json, 缠论's records over those bars, as it is. Exit 1 with no DIR or no vectors.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [dir] = process.argv.slice(2);
const vectors = process.env.CHANLUN_VECTORS;
if (dir === undefined || vectors === undefined || vectors === "") {
  console.error("vectors: bun vectors.ts DIR, in the project's shell (nix develop), which names CHANLUN_VECTORS");
  process.exit(1);
}

// bars.ts's lines: date (milliseconds), open, high, low, close, volume
const lines = execFileSync("bun", [join(vectors, "bars.ts"), "4000"], { encoding: "utf8" }).trim().split("\n");
const minute = (ms: number): string => new Date(ms).toISOString().slice(0, 16).replace("T", " ");
const rows = lines.map((line) => {
  const [date = "", ...prices] = line.split(",");
  return [minute(Number(date)), ...prices].join(",");
});

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "bars.csv"), `time,open,high,low,close,volume\n${rows.join("\n")}\n`);
writeFileSync(
  join(dir, "request.json"),
  `${JSON.stringify({
    scale: 100,
    source: "the vectors of chanlun 3.1.0 (qi-v2-contracts): bars made up by bars.ts, not of any market",
  })}\n`,
);
writeFileSync(join(dir, "run.json"), readFileSync(join(vectors, "run.json"), "utf8"));
console.log(`vectors: ${dir}: bars.csv (${rows.length} bars), request.json, run.json`);
