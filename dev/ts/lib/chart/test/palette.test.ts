// The palette's names (docs/designs/design-chart-chanlun-3-2026-11-09.md, The palette's names): the package's README
// names, in its table, every palette name the library's code uses, in its sources and its engines' scripts, and no
// other, so a caller finds each name a page's PALETTE must give and what it colours.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const names = (text: string): readonly string[] => text.match(/cl-[a-z0-9-]*[a-z0-9]/g) ?? [];
const used = new Set(
  ["src", "engine"].flatMap((dir) =>
    readdirSync(join(root, dir))
      .filter((f) => f.endsWith(".ts"))
      .flatMap((f) => names(readFileSync(join(root, dir, f), "utf8"))),
  ),
);
// the table's rows: | `cl-…` | what it colours |
const table = new Set(
  readFileSync(join(root, "README.md"), "utf8")
    .split("\n")
    .flatMap((line) => /^\| `(cl-[a-z0-9-]+)` \|/.exec(line)?.slice(1) ?? []),
);

describe("the palette's names", () => {
  it("are in the README's table, every one the library's code uses and no other", () => {
    expect([...table].sort()).toEqual([...used].sort());
  });
});
