# @qi/chart version 3: the structure on chanlun 3.1.0 (2026-11-09)

Version 3 of `@qi/chart` and its release, 3.0.0: the structure a caller gives is 缠论's contract `chanlun` 3.1.0's
records, the K-lines beside them `market` 1.1.0's, and nothing of `chanlun` 1.1.0 stays. The rest of the library is
`design-chart-lib-2026-10-24.md`, whose Versions, 3, points here, and whose The contracts and The DSL (layer 2) this
design replaces; the online component is `design-chart-online-2026-11-08.md`, unchanged. The chart app's input, its
design's The results, Making a run, Reading it into the contracts and Known of the results
(`design-chart-app-2026-10-24.md`), is replaced by The chart app below, and that design is brought to it with the
build. It rests on `qi-v2-contracts`
at the tags `chanlun-3.1.0` and `market-1.1.0`, one commit (`3354d2b`): `chanlun/SPEC.md` (its Reading the records
above all), `chanlun/ts/`, `chanlun/vectors/`, `market/SPEC.md`, `market/vectors/`.

## Why

- `chanlun` 3.1.0 is the contract's release, and every part takes the newest version of what it takes.
- 3.1.0 is what the algorithm makes beyond the K-line: a run holds no K-line; a position is the place of a K-line of
  `market`'s, given beside the run; a price is market's decimal. Its records are smaller than 1.1.0's: a 分型 is its
  `mIndex` alone, a line its `start`, `end` and `confirmEnd`, a 中枢 has no `ggBar` or `ddBar`; a merged bar names the
  K-lines of its extreme (`extremes`) and the one that represents it (`index`). The kind of a 分型, the direction and
  the prices of a line are read from the merged bars (SPEC, Reading the records).
- The results on 3.1.0 (`chanlun-results` 0.8.0) hold the runs alone and name no K-lines they were made from, so no
  published results can be drawn on 3.1.0.

## What this design guarantees

1. **Nothing of `chanlun` 1.1.0**: no record, schema or package of it in the code, in `flake.lock`, in the packages
   `qi-chart` and `chart`, or in what a caller bundles.
2. **A structure is drawn only on K-lines it fits**: `located` refuses, its fault named and the chart whole, a run whose
   positions are not the K-lines given, a merged bar whose `extremes` do not hold its extreme, a record that names a
   merged bar the run does not have.
3. **The library computes no structure**: it reads the records as SPEC's Reading the records says, and makes no record.
4. **Every record is drawn at the K-lines the contract names**, a merged bar's `index` and `extremes`; no drawing finds
   a K-line any other way.
5. **A price is never rounded**: the K-lines at the chart's scale, as 2.0's; the structure's prices as the contract's
   decimals.
6. **A chart of bars alone is 2.0.1's**: its page data and the pixels of its pages, by `make chart-static`'s hashes of
   the bars alone, which stay 2.0.1's.
7. **The online component is 2.0's**, its guarantees 2 to 5, with no structure.

## What 1.8's reading gave, and how each is kept

| 1.8 (`design-chart-lib-2026-10-24.md`, The contracts, The DSL) | Now |
|---|---|
| every field the producer gives is kept | kept: the run whole, as decoded |
| one map from a merged bar to its K-lines, for every configuration | kept: the map is the contract's, a merged bar's `index` and `extremes` by its `mIndex`; the library no longer searches the K-lines for the extreme |
| `located`: every merged bar named exists and holds its extreme on one of its K-lines, else the chart refused whole | kept and widened (guarantee 2): each K-line of `extremes` holds the extreme; every position is a K-line given |
| no structure computed | kept (guarantee 3) |
| drawn by the confirmations: nothing without `confirmStartDate`, dashed without `confirmEndDate` | changed: 3.1.0 has no confirmation of a start (a record's first K-line confirms it), so every record is drawn, dashed without `confirmEnd`, solid with it. Lost: a 分型's two colours, since 3.1.0's 分型 holds no confirmation |
| level L's group: its 线段 (the 走势 of level L − 1) and its 中枢 | changed: level L's 线段, 走势 and 中枢 (The levels) |
| 成交量分布 for each 笔, each level's 线段 and 中枢 | kept, and each level's 走势 added, which had one as a 线段 of the level above |
| the prices whole numbers at the scale | kept for the K-lines; the structure's are the contract's decimals, the same numbers (a whole number at a power of ten divided by it is the decimal's nearest double, as the decimal's text is) |
| the app's structure from the published results only | replaced: no results taken; a run given beside its bars (The chart app) |
| the app's window over a run's structure | lost for a run, kept for bars alone (The chart app) |
| `make chart-check`: the structure in every engine in a browser and in the picture | kept, on the contract's own vectors |

## The components

`Components`: the title, the scale, the options, `xAxis` and `run`, the add-ons.

- **`xAxis`**: market 1.1.0's K-lines, at least one, strictly in time (`xAxisSchema`, market's `klineSchema` alone);
  `located` makes them bars as 2.0 does (each index one after the one before, each date a whole second, each price
  exact at the scale).
- **`run`**: a `chanlun` 3.1.0 `Run`, its six parts as the contract holds them (`merged`, `fractals`, `strokes`, and by
  level `segments`, `moves`, `consolidations`); a run of no record for a chart of bars alone. Why the run whole: it is
  the contract's own record of a series, decoded at the caller's boundary by the contract (`decodeRun`, `runSchema`),
  so the library holds no second form of it.
- **A position** `p` of the run is the K-line whose `index` is `p`: market's `index` is a K-line's place in its series,
  and so is chanlun's position. `located` makes the run's positions the x-axis's, `p` less the first K-line's `index`,
  as it makes the K-lines bars.

**What `located` checks**, beside the K-lines as 2.0 checks them:

1. every position of a merged bar (`index`, `start`, `end`, `confirmEnd`, each of `extremes`) is one of the K-lines
   given;
2. each K-line of a merged bar's `extremes` holds its extreme: its high when the merged bar goes up, its low when it
   goes down, compared at the scale (an extreme finer than the scale holds no K-line's price);
3. every merged bar a record names (a 分型's `mIndex`; a line's and a 中枢's `start`, `end`, `confirmEnd`) is one of
   the run's.

Why 1 and 2: the run names no K-lines, so the K-lines given beside it are the caller's word; these are the checks of
it the records allow, which neither contract can make, each holding one side. Why 3: it is the run's own rule,
checked again because every drawing looks a merged bar up by its number, as 1.8's `located` did. The run's other rules
are not checked again: the caller decodes it at its boundary (`dev/ts/STYLE.md`, Decode at the boundary).

## Reading the records

A merged bar is looked up by its `mIndex`, its place among the merged bars; it gives its `index` and its `extremes`, as
positions on the x-axis, and its extreme, its `high` when it goes up and its `low` when down (SPEC, Reading the
records). From these alone:

- **包含**: a merged bar of two K-lines or more (`start < end`): a box from `start` to `end`, `low` to `high`, in its
  direction's colour, lightly filled; a mark at each of `extremes`, above when it goes up, below when down.
- **分型** at `mIndex` m: a top where merged bar m goes up and m + 1 down, a bottom where m goes down and m + 1 up; a
  circle at m's `index`, above a top, below a bottom. A 分型 the records make neither (no merged bar m + 1, or one of
  m's direction; `run.json`'s first is one) has no kind, and is not drawn.
- **A line** (笔, 线段, 走势): from its `start` merged bar's `index` at its extreme to its `end` merged bar's `index` at
  its extreme. A 走势 goes up where its end's extreme is above its start's and down where it is below (SPEC), in the
  up or the down colour, a step wider per level; one whose ends are level has no direction in the records, and takes
  a colour of its own, `flat` (The options).
- **中枢**: from its `start` merged bar's `index` to its `end` merged bar's `index`, a box DD to GG lightly filled and a
  box ZD to ZG filled darker, in its level's colour, a step wider per level.
- **成交量分布**: over the K-lines from a 笔's, 线段's, 走势's or 中枢's `start` merged bar's `index` to its `end`'s.
- **The confirmations**: a merged bar, a line and a 中枢 dashed while it has no `confirmEnd`, solid once it has; a 分型
  in one colour.

## The levels

Level L's group holds its 线段 (`segments[L]`), its 走势 (`moves[L]`) and its 中枢 (`consolidations[L]`); level 0's
also 包含, 分型 and 笔. The levels run from 0 to the highest a part holds; a group with no layer is not drawn. Why: they
are the contract's levels (a 线段 of level L, a 走势 of level L), and 3.1.0 no longer states that the 线段 of level
L + 1 is the 走势 of level L (its 2.1.1); drawing a 走势 in the group above, as 1.8 did, would state again what the
contract dropped.

The layers' keys: `merged`, `fx`, `bi`, `duan<L>`, `zoushi<L>`, `zhongshu<L>`; their names 包含, 分型, 笔, 线段, 走势,
中枢; 成交量分布's layers `profile:bi0`, `profile:duan<L>`, `profile:zoushi<L>`, `profile:zhongshu<L>`, named 笔,
线段 L, 走势 L, 中枢 L. A 线段 of any level takes the style `duan`, a 走势 the style `zoushi`; the app's dialog finds a
layer's settings by its name.

## The options

As 2.0's but for two styles:

- 分型's: `{ colour, size }` in place of `{ confirmed, unconfirmed, size }`, `colour` by default `cl-ink` (1.8's
  confirmed colour), since a 3.1.0 分型 holds no confirmation;
- 走势's gains `flat`, by default `cl-muted`, the colour of a 走势 whose ends are level: a colour of its own since the
  records give it no direction, and a setting since every colour is one.

Neither is in a chart's page data but through the items it colours, so a chart of bars alone is unchanged by them.

## The palette's names

The package's README has the table of every palette name the library uses, in the engines' scripts and in the
options' defaults, and what each colours; a test holds the table to the names in the library's code, every one and no
other. A page gives `PALETTE`, each name its light and its dark colour, these and every name its options and marks
name. Why the README, not a palette the package gives: the names are the library's, the colours the page's, which
its caller makes as it makes the page; a palette in the package would choose the colours for every taker, and be a
second home of those the app's `palette.json` holds.

## The package

- `@qi/chanlun` is `chanlun-ts`'s at `chanlun-3.1.0` (the flake input `contracts`, `?ref=chanlun-3.1.0`, its `qi-v2`
  and `kit` following this project's), `@qi/market` `market-ts`'s at `market-1.1.0` (the input `market`, as 2.0's),
  `zod` npm's 4.1.12, pinned by hash, as 2.0's; the package copies `@qi/chanlun` alone of `chanlun-ts`, whose own
  `@qi/market` and `zod` are the same files and the same version (one commit, `3354d2b`; zod 4.1.12), so its imports
  resolve to the package's. Two inputs of one commit, since each product is pinned by its own release's tag and moves
  by its own release; that the two releases share a commit is the contracts', not a fact the pins rest on. In
  `dev/ts/`, `@qi/chanlun` is linked from `chanlun-ts` and reads its own `@qi/market` and `zod` there, as 2.0's did.
- The licence, Apache 2.0: `"license": "Apache-2.0"` in its `package.json`, a line in its README, and the repository's
  `LICENSE` in the package beside its README, since the licence asks that a copy go with the work.
- **3.0.0**: a release has one number, its design's (`agents/rules.md`, A release), and this project numbers a
  version of the library by its design (`design-chart-lib-2026-10-24.md`, Versions: the package's number the
  design's); this is version 3, its major number new since its input changes as a caller's code must follow: a
  caller's code that gives a structure, 缠论's K-lines or 分型's two colours no longer type-checks. The project has no
  other rule for a change of input.
- Its README: Changes (3.0.0; 2.0.0's tag, `qi-chart-2.0.0`, of the earlier history, which this repository does not
  hold), What the package holds, Taking it (`?ref=qi-chart-3.0.0`), Using it (the components with `run`, what
  `located` checks, the levels), the palette's table.

## The chart app

- **It takes no results**: `results.lock`, `make results-fetch`, `dev/scripts/results.py`, `dev/scripts/locks-check.py`
  (`make locks-check` is the kit's `kit locks` alone), the path of a set (`make chart SET=`, `--results`, `--scale`),
  and every chart, check and hash of a set go; `crane` leaves the shell.
- **Its charts are of bars alone** (`--input`, `--request`), as `test/data/` has, until results are published that
  name the K-lines they were made from.
- **Its path for a structure stays, on 3.1.0**: `--run FILE` with `--input` and `--request`, a run decoded by
  `decodeRun`, its positions the places of the bars given (K-lines indexed from 0). Why: this version changes how the
  structure is drawn, and every page is looked at in both engines on the same view and checked in a browser and in the
  picture; the contract's own vectors are a run with its K-lines beside it, public and made up (`run.json` over the
  4,000 bars `bars.ts` makes); a run beside its K-lines is how 3.1.0 gives a structure. Results that name their
  K-lines are taken by a design of their own when they are published.
- `make vectors` writes `.reports/vectors/`: `bars.csv`, `bars.ts`'s 4,000 bars in the app's input form, its
  `request.json` (scale 100, its source the contract's vectors), and `run.json` as it is; from the flake input
  `contracts`, whose vectors the shell names (`CHANLUN_VECTORS`, and market's `MARKET_VECTORS`).
- `make chart INPUT= REQUEST= [RUN=]` or `DIR=`; `CHANLUN=none`, which said no structure, goes, since `RUN=` now adds
  one. A run's folder holds `in.csv` and `meta.json` (scale, source, title, `run: true` with a run) and `run.json` with a
  run.
- With a run, `--window` is refused: a 3.1.0 run numbers its merged bars by place, so a window would number every
  record again and cut the confirmations past its end, a structure its producer did not give. `--online` stays of bars
  alone.
- The page's source line names the run beside the bars; the command's summary counts 3.1.0's records.

## The project

- `flake.lock`: the input `contracts` at `chanlun-3.1.0`, no node at `chanlun-1.1.0`; no other input moves.
- `PRODUCTS.md`: `qi-chart` 3.0.0 by the tag `qi-chart-3.0.0`; `chanlun-results` gone from Takes; Responsibility as
  above.
- `make check`: every target `dev/scripts/verify.py --all` runs, in the shell, offline.
- `agents/rules.md`: the repository public; what it takes without the results; 3.0.0 in its first lines; then `make
  agents`. `README.md`: 2.0.0's tag of the earlier history; no results.

## How the release is checked

1. **`make ts`**: the library's tests on 3.1.0's records; the contract's vectors: `run.json` over `bars.ts`'s 4,000
   bars drawn by each engine, each layer's items counted against the records; `small.json` and `edge.json` on six
   K-lines made to fit them; `bounds.json` refused at every scale (no scale holds both its prices); each refusal of
   `located` with its fault; market's ongoing vector given to the online component on `bars.ts`'s first six K-lines,
   its tail applied the batch's; the palette's table against the code.
2. **`make chart-check`**: the test data's bars with the marks, every engine, the picture of the last 2,000; the
   vectors' run at all levels (with its picture of the last 2,000), at level 0 and at level 1; each page's script
   against the command's description; both all-levels runs in headless Chromium; the online page.
3. **`make chart-static`**: the bars alone's four hashes 2.0.1's; the other pages' (the bars with the marks and the
   picture, the vectors' run at its three levels) recorded by this release, and the same when made again.
4. **`make chart-package`**: the package `chart` on the bars, again from the run made, and on the vectors' run beside
   its bars.
5. **`make qi-chart-package`**: the taker's script from the package alone: `small.json`'s records beside six market
   K-lines by every engine and the picture, then the online component.
6. **`make check`** through `nix develop --offline -c`; in the role `checker`, `make verify VERIFY=--all` after the
   last change; `nix flake check`; no `@qi/chanlun` but 3.1.0's in the tree or in `qi-chart`'s store path.

## The release

Whole before it is published: one review in the role `reviewer` of the diff; then one commit holds the version 3.0.0
(in `dev/ts/lib/chart/package.json` and `dev/ts/bun.lock`'s workspace entry, the flake's `qi-chart`, `PRODUCTS.md` and
the README's Changes), its documents (this design among them, `docs/opening.md` and `docs/milestones.md`) and its lock
(`flake.lock`), committed by explicit paths. That commit is tagged `qi-chart-3.0.0`, annotated; the push of `main` and
the tag is the last step, and nothing is committed after it.

## What changes for a caller

- `Components`: `run`, a `chanlun` 3.1.0 `Run`, in place of `merged`, `fractals`, `strokes`, `duan`, `zoushi`,
  `zhongshu`; `xAxis` market's K-lines alone.
- The structure drawn as Reading the records and The levels say; `located` refuses as above.
- `options.fx.style`: `colour` in place of `confirmed` and `unconfirmed`; `options.zoushi.style`: `flat` added.
- The page data's layers and groups: the keys and names of The levels.
- `@qi/chanlun` 3.1.0 in the package: its records' names (`Consolidation`, `Line`, `Segment`, `Move`), no K-line.

## What 3.0.0 holds, and what is left

It holds the above. Left, each for a version of its own: the structure online; results that name their K-lines,
taken by the app; a window over a run; dates finer than a second; drawing only what an update changes.
