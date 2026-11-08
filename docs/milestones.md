# The milestones

The project's milestones and where each stands now. Where the last session stopped: `docs/opening.md`.
This repository's history begins at `qi-chart` 2.0.1's tree (`docs/decisions.md`, 2026-11-08): a commit named here
from before it, the one tagged `qi-chart-2.0.0` among them, is of the earlier history, which it does not hold.

| # | Milestone | Stands |
|---|---|---|
| 1 | `@qi/chart` and the chart app here, version 1.8, built and checked | copied, checked, committed |
| 2 | Version 2, online, released as 2.0.0 | released: the tag `qi-chart-2.0.0` |
| 3 | The tooling to the practices of every qi-v2 project | in place, committed; CI open |
| 4 | The structure only from the published results; `PRODUCTS.md` | done |
| 5 | Ready to be public: nothing private taken or named; `@qi/base` and `@qi/core` from `qi-v2-ts` | released: the tag `qi-chart-2.0.1`; public, its history begun anew |

## 1 `@qi/chart` and the chart app here

**Stands.** The copy at version 1.8 (`docs/decisions.md`, 2026-10-28): `dev/ts/`, the packages `qi-chart` and
`chart`, the test data (`test/data/`: the public BTCUSDT minutes and marks on them), the designs (`docs/designs/`).
Checked: `make ts`, `chart-check`, `chart-package`, `qi-chart-package`.

**Left.** Nothing: `@qi/base` and `@qi/core` have their own home, `qi-v2-ts` (milestone 5).

## 2 Version 2, online, released as 2.0.0

Beside the batch, an online component: a chart taken one K-line at a time, appended or the forming one replaced; the
K-lines (`market` 1.1.0's) and, later, their structure taken from the library's caller; the engines redrawing from the
change (`docs/designs/design-chart-online-2026-11-08.md`). Released whole as `qi-chart` 2.0.0, the project's first
release, by tag: one commit holding the version and its documents, tagged `qi-chart-2.0.0`, and nothing committed
after its push (`docs/decisions.md`, 2026-11-08).

**Stands.** Its design, `docs/designs/design-chart-online-2026-11-08.md`, reviewed once; its choices the owner's or
left by the owner to the session (`docs/decisions.md`, 2026-11-08). Built: the online component (`src/online.ts`,
`src/tails.ts`, `src/applied.ts`), market's K-line the batch's input in the plain bar's place, `UPDATE` in both
engines, the chart app's online page; checked by the design's checks 1 to 4 (How the release is checked): the
property tests, `make chart-static` (the static charts 1.8.0's, byte for byte), `make chart-online-check` (in `make
chart-check`), `make qi-chart-package`; reviewed once, its findings settled. Released (check 5): the version 2.0.0
in the package, the flake, `PRODUCTS.md` and the README's Changes, one commit, tagged `qi-chart-2.0.0` and pushed.

**Left.** Nothing of 2.0.0. What it leaves, each for a version of its own: the design's What 2.0.0 holds, and what is
left.

## 3 The tooling

**Stands.** `flake.nix`, `flake.lock`; the `Makefile` (`make help`); `make install`; `agents/`; `dev/hooks/pre-commit`
running `make verify`; `make locks-check` (`flake.lock`, `results.lock`); `make products-check`.

**Left.** CI (`docs/decisions.md`, Open).

## 4 The structure only from the published results

**Stands.** `results.lock` names the product `chanlun-results`; `make results-fetch` takes its files; `make chart
SET=<set>` draws a set, decoded by the contract's `decodeRun`; `make chart-check` and `make chart-package` draw the set
`btcusdt-1m-test`. `PRODUCTS.md` states what the project owns, gives and takes: its one product `@qi/chart`
(`qi-chart`), the chart app its own tool (`docs/decisions.md`, 2026-11-08).

**Left.** Nothing.

## 5 Ready to be public

**Stands.** Everything the project takes is public and read with no login: the flake's inputs over HTTPS, the
results' image from GHCR by `crane` with no stored login (`docs/decisions.md`, 2026-11-08). `@qi/base` and `@qi/core`
are `qi-v2-ts` 0.1.0's, the flake input `qi-v2-ts` at its tag, linked by `make qi-v2-ts-link` and copied into the
packages `qi-chart` and `chart`; the copies here are removed. No tracked file names a private project or holds what
only one holds. Released as `qi-chart` 2.0.1, its files changed and not its code: one commit, tagged
`qi-chart-2.0.1` and pushed; the static charts the same, by `make chart-static`. The repository is public, its history
begun anew: after GitHub's own commit, one commit holds 2.0.1's tree, tagged `qi-chart-2.0.1` again, its package the
same; the licence Apache 2.0, the branch `main` (`docs/decisions.md`, 2026-11-08).

**Left.** The licence in the package's own files, its `package.json` and its README, at its next release.
