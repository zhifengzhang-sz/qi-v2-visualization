# The milestones

The project's milestones and where each stands now. Where the last session stopped: `docs/opening.md`.
This repository's history begins at `qi-chart` 2.0.1's tree (`docs/decisions.md`, 2026-11-08): a commit named here
from before it, the one tagged `qi-chart-2.0.0` among them, is of the earlier history, which it does not hold.

| # | Milestone | Stands |
|---|---|---|
| 1 | `@qi/chart` and the chart app here, version 1.8, built and checked | copied, checked, committed |
| 2 | Version 2, online, released as 2.0.0 | released: the tag `qi-chart-2.0.0` |
| 3 | The tooling to the practices of every qi-v2 project | in place, committed; CI open |
| 4 | The structure only from the published results; `PRODUCTS.md` | done; the results no longer taken (6) |
| 5 | Ready to be public: nothing private taken or named; `@qi/base` and `@qi/core` from `qi-v2-ts` | released: the tag `qi-chart-2.0.1`; public, its history begun anew |
| 6 | `@qi/chart` on `chanlun` 3.1.0, nothing older taken | released: the tag `qi-chart-3.0.0` |

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
running `make verify`; `make check`; `make locks-check` (`flake.lock`); `make products-check`.

**Left.** CI (`docs/decisions.md`, Open).

## 4 The structure only from the published results

**Stands.** `PRODUCTS.md` states what the project owns, gives and takes: its one product `@qi/chart` (`qi-chart`), the
chart app its own tool (`docs/decisions.md`, 2026-11-08). The published results, `chanlun-results`, are no longer
taken (milestone 6): their release on `chanlun` 3.1.0 names no K-lines it was made from.

**Left.** Nothing.

## 5 Ready to be public

**Stands.** Everything the project takes is public and read with no login: the flake's inputs over HTTPS
(`docs/decisions.md`, 2026-11-08); the results' image, read from GHCR with no login while it was taken, is no longer
taken (milestone 6). `@qi/base` and `@qi/core`
are `qi-v2-ts` 0.1.0's, the flake input `qi-v2-ts` at its tag, linked by `make qi-v2-ts-link` and copied into the
packages `qi-chart` and `chart`; the copies here are removed. No tracked file names a private project or holds what
only one holds. Released as `qi-chart` 2.0.1, its files changed and not its code: one commit, tagged
`qi-chart-2.0.1` and pushed; the static charts the same, by `make chart-static`. The repository is public, its history
begun anew: after GitHub's own commit, one commit holds 2.0.1's tree, tagged `qi-chart-2.0.1` again, its package the
same; the licence Apache 2.0, the branch `main` (`docs/decisions.md`, 2026-11-08).

**Left.** Nothing: the licence is in the package's own files from 3.0.0 (milestone 6).

## 6 `@qi/chart` on `chanlun` 3.1.0

The structure a caller gives is `chanlun` 3.1.0's run, the K-lines beside it `market` 1.1.0's, and nothing of
`chanlun` 1.1.0 stays (`docs/designs/design-chart-chanlun-3-2026-11-09.md`; `docs/decisions.md`, 2026-11-09).

**Stands.** The design, reviewed once, its findings settled; its choices the owner's. Built: `@qi/chart`'s components
take `run` and market's K-lines alone; `located` checks the run against the K-lines; the records drawn as the contract
reads them, each 线段, 走势 and 中枢 at its own level; the 分型's one colour, the 走势's `flat`; the palette's names in the
package's README, held to the code by a test; the structure tested on the contract's vectors (`run.json` over
`bars.ts`'s bars, `small.json`, `edge.json`, `bounds.json`, market's ongoing K-line). The chart app takes no results:
its charts of bars alone, a run of 3.1.0 beside them by `--run`, checked on the vectors (`make vectors`); `make check`
added. Released as `qi-chart` 3.0.0: the flake input `contracts` at `chanlun-3.1.0`, the package holding `LICENSE`;
one commit, tagged `qi-chart-3.0.0` and pushed.

**Left.** What 3.0.0 leaves, each for a version of its own (the design's What 3.0.0 holds, and what is left): the
structure online; results that name their K-lines, taken by the app; a window over a run; dates finer than a second;
drawing only what an update changes. CI (`docs/decisions.md`, Open).
