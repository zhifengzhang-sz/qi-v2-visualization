Opening for the next session, written 2026-11-09 by the session that released `qi-chart` 3.0.0, `@qi/chart` on
`chanlun` 3.1.0 (`docs/process.md`). It says where the work stands, the next task, and what to read.

## Where the work stands

- **`qi-chart` 3.0.0 is released** (milestone 6; `docs/designs/design-chart-chanlun-3-2026-11-09.md`; `docs/decisions.md`,
  2026-11-09): a chart's 缠论 data is a run of `chanlun` 3.1.0 (`run`), the x-axis `market` 1.1.0's K-lines alone,
  beside which the run is, its positions their indexes; `located` refuses a run whose positions are not the K-lines',
  whose `extremes` do not hold their merged bar's extreme, or whose records name a merged bar it does not have; the
  records drawn as the contract reads them, each 线段, 走势 and 中枢 in the group of its own level; 分型's style one
  `colour`, 走势's `flat` added; the palette's names in the package's README, held to the code by
  `dev/ts/lib/chart/test/palette.test.ts`; `LICENSE` in the package, `"license": "Apache-2.0"` in its `package.json`.
  The version is 3.0.0 in `dev/ts/lib/chart/package.json` (and `dev/ts/bun.lock`'s workspace entry), the flake's
  `qi-chart`, `PRODUCTS.md` and the README's Changes; the commit is tagged `qi-chart-3.0.0` and pushed with `main`.
- **Nothing of `chanlun` 1.1.0**: the flake input `contracts` is at `chanlun-3.1.0` (`3354d2b`, the commit of
  `market-1.1.0`, the input `market`), its `qi-v2` and `kit` following this project's; `flake.lock` holds no node at
  `chanlun-1.1.0`; the package `qi-chart` holds `@qi/chanlun` 3.1.0 alone.
- **The chart app takes no published results** (`results.lock`, `make results-fetch`, `dev/scripts/results.py`,
  `dev/scripts/locks-check.py`, `make chart SET=` gone; `crane` out of the shell): its charts are of bars alone
  (`INPUT=`, `REQUEST=`), and a run of 3.1.0 beside the bars by `RUN=` (`--run`), `--window` refused with it. `make
  vectors` writes the contract's own vectors in the app's input form into `.reports/vectors/` (from the flake input
  `contracts`, named by the shell as `CHANLUN_VECTORS`, and market's as `MARKET_VECTORS`); `make chart-check`, `make
  chart-package` and `make chart-static` draw them beside the test data's bars. The chart app's package keeps 1.8.0.
- **`make check`** runs every target of `dev/scripts/verify.py`'s table (the owner's, 2026-11-09).
- **Checked**, after the last change of code, with no login and no token in the environment: by the role `checker`,
  `nix develop --offline -c make check` (ts, chart-check, chart-package, qi-chart-package, products-check,
  agents-check, each PASS) and `make chart-static` (22 hashes the same; the four of the bars alone 2.0.1's, the others
  recorded by this release); by the session, `nix flake check --offline`, and a search of the tree and of `qi-chart`'s
  store path finding no `@qi/chanlun` but 3.1.0's. The design reviewed once, the diff once, by the role `reviewer`.
- **The locks**: `make locks-check` was not run (its kit reads GitHub; no credential is used without asking). At the
  last run (2026-11-09, before this release): `nixpkgs` outdated (`nixos-26.05`, through `qi-v2`'s lock); `kit`,
  `market`, `qi-v2` and `qi-v2-ts` current; `contracts` now at its release, `chanlun-3.1.0`.
- **`origin`** is the repository's SSH URL, which a push uses; it is read over HTTPS with no login, by the standing
  rule below (`git pull https://github.com/zhifengzhang-sz/qi-v2-visualization main`).
- The test data: `test/data/BTCUSDT-1m.csv` (4,000 public minutes of Binance US) and `marks.json`, drawn on them.
- Kept as it is: `dev/ts/package.json`'s workspace name `chanlun-dev` (renaming it changes `bun.lock`); the code's
  identifiers `lean` in `dev/ts/app/chart/src/edge/main.ts` and `dev/ts/app/chart/test/marks.test.ts` (the marks'
  decoder and its test's fixture): the owner's to rename or keep.
- The owner's local file: `todo.md`.

## The next task: the owner's to set

None is set. What the record holds for it: the design's What 3.0.0 holds, and what is left (the structure online;
results that name their K-lines, which the app would take by a design of their own; a window over a run; dates finer
than a second; drawing only what an update changes); the Open entry of `docs/decisions.md` (CI). Read
`docs/decisions.md` and `docs/milestones.md` first.

## Standing rules learnt (until the owner approves them for `agents/rules.md`)

- **No credential of the owner's is used without asking first**, whatever the reason, GitHub's rate limit included:
  gh's token, a registry login, a token passed to `nix` through `NIX_CONFIG` or the environment (the environment holds
  `GITHUB_PERSONAL_ACCESS_TOKEN`: a command that reaches the network runs with it unset, and git with no credential
  helper), the GitHub tools of an MCP server, an SSH key for anything but a push the brief allows (a `git fetch` or
  `git ls-remote` of `origin` uses it too: GitHub's public repositories are read over HTTPS instead). Why: a
  credential acts as its owner, and what is done in the owner's name is the owner's to decide.
- **No private project is taken or named**: what the project takes is public and read with no login; no tracked file
  names a private project, a short name standing for one, or what only one holds (`docs/decisions.md`, 2026-11-08).
- **What a project takes from another conforms to the contracts of `qi-v2-contracts`**: they are how the projects
  communicate with each other (`docs/decisions.md`, 2026-11-08).
- **Every part takes the newest version of each product it takes**; an older one only by the owner's leave. Why: an
  upgrade updates the whole system (`docs/decisions.md`, 2026-11-08).

## Open, for the owner

- The standing rules above, for `agents/rules.md`.
- In `docs/decisions.md`, Open: CI.
