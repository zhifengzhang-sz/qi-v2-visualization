// The style's checks checked: biome on biome/fixture/violations.ts must report every rule (dev/ts/STYLE.md).
// A plugin that stops firing would go unseen; this fails when one does.

const expected = [
  "no classes",
  "no throw",
  "no try",
  "no let",
  "no loops",
  "noRestrictedImports",
  "noRestrictedGlobals",
  "no randomness",
] as const;

const out = Bun.spawnSync(["biome", "lint", "--max-diagnostics=100", "biome/fixture/violations.ts"], {
  stderr: "pipe",
  stdout: "pipe",
});
const text = out.stdout.toString() + out.stderr.toString();
const missing = expected.filter((rule) => !text.includes(rule));
const classes = (text.match(/no classes/g) ?? []).length;

const clean = Bun.spawnSync(["biome", "lint", "biome/fixture/clean.ts"], { stderr: "pipe", stdout: "pipe" });
const flagged = clean.exitCode !== 0;
const problems = [
  ...(missing.length === 0 ? [] : [`rules that did not fire: ${missing.join(", ")}`]),
  ...(classes >= 2 ? [] : [`no-class fired ${classes} time(s), expected 2 (class, export default class)`]),
  ...(flagged ? [`clean.ts was flagged:\n${clean.stdout.toString()}${clean.stderr.toString()}`] : []),
];

console.log(
  problems.length === 0
    ? `biome/verify: all ${expected.length} rules fire on the fixture, and the clean file passes`
    : `biome/verify: ${problems.join("; ")}\n${text}`,
);
process.exit(problems.length === 0 ? 0 : 1);
