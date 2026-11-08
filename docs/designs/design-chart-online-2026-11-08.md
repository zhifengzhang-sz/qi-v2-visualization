# @qi/chart version 2: online (2026-11-08)

Version 2 of `@qi/chart` and its first release, 2.0.0: beside the batch component, which draws a chart whole, an online
component, which takes a chart one K-line at a time, each appended or replacing the one still forming, and gives each
engine the change to redraw. The rest of the library is `design-chart-lib-2026-10-24.md`, whose Versions, 2, points
here. This design rests on: the market data contract `market` 1.1.0 (`qi-v2-contracts` at the tag `market-1.1.0`, its
`market/SPEC.md` and `market/ts/`); the engines' online behaviour, `docs/research/chart-online-2026-10-24.md`; the
engines' rules, `design-engines-2026-10-24.md`; the code's style, `dev/ts/STYLE.md`.

## What this design guarantees

1. **The static charts are 1.8's.** 2.0.0 changes none of the functions that make a chart's page data (tv's
   `qi-chart/1` and `qi-layers/1`, d3fc's `qi-d3fc/1`) and its TikZ picture from its bars and its structure; it adds
   beside them. So for the same input every static chart's page data and picture are the same bytes as 1.8.0 makes
   them, and each static page draws the same pixels. A page file is not the same file (Why a page file changes).
2. **An online chart is the chart of its K-lines drawn whole.** After any updates of a chart's components, each
   engine's page data, the batch's of the components it started from with every change applied, is the batch's of the
   components it ends with, and the page draws the same pixels.
3. **The library takes the contracts' records and nothing of where they come from**: no source, no transport, no
   taker.
4. **An update outside the rules is refused**, as a value with its fault named, the chart as it was. A price is never
   rounded; a K-line is never dropped, reordered or revised once complete.
5. **The view follows the newest K-line only while it is in view.**

### Why a page file changes

A static page inlines the app's bundle, with the library, and its engine's script (`dev/ts/app/chart/src/page.ts`,
the scripts of each page). The files stay the same only if no module or script a static page carries changes. The
online component would then reach a drawn chart only through the handles a static page's script gives already, and
the one that redraws, `REDRAW`, removes the chart and draws it anew from the whole page data, keeping the view as the
range of places it had (`engine/shared.ts`, `install`; tv's view is `getVisibleLogicalRange`, `engine/tv.ts`; d3fc's,
its x domain, `engine/d3fc.ts`). So each update would make the whole page data again and rebuild every series and the
chart's element, and an appended K-line would fall outside the range kept: the view would not follow it, and
guarantee 5 would be lost. So the engines' scripts change, and a page file with them.

## The two components

**The batch component, as 1.8**, but for its K-line. `Components` (the title, the scale, the options, the x-axis,
缠论's data, the add-ons) through `located` to `tvChart`, `d3fcChart` and `tikzChart`; each engine's script draws the
page data the page gives it. The x-axis's K-line is `market` 1.1.0's, in the place of the library's plain bar as an
input (`barSchema`, which stays the library's own form inside): what a project takes from another conforms to the
contracts of `qi-v2-contracts`. In 2.0 the x-axis could also be `chanlun` 1.1.0's K-line, for the chart app's static
charts on `chanlun-results` 0.2.0; since version 3 it is market's alone, and 缠论's data a run of `chanlun` 3.1.0 beside
it (`design-chart-chanlun-3-2026-11-09.md`). `located` makes each market K-line a bar:

- its position its `index` less the first K-line's, the indexes one after another;
- its date in whole seconds; a date that is not a whole second is refused, since both engines' page data hold whole
  seconds and Lightweight Charts' time is a number of seconds (`UTCTimestamp`);
- each price a whole number at the chart's scale, read exactly from its digits (the contract gives each price back as
  its digits, `market/SPEC.md`, Units); a price with more digits after the point than the scale holds, or past 2⁵³ − 1
  at the scale, is refused; the scale a power of ten, 1 to 1,000,000, for the contract's prices have at most 6 digits
  after the point;
- its volume as it is.

Made from the same bars, as the app makes them (What changes for the chart app), a chart of bars alone has the same
page data.

**The online component, new.** It runs where the engines draw, in the browser, in the caller's page, bundled with the
caller's script as the library is today (`design-chart-lib-2026-10-24.md`, Version 1.7, step 2); a change made
anywhere else reaches the page only as a page made again. It takes a chart's components as the batch takes them and
draws nothing whole: the batch draws. Its K-lines are the contract's, in the contract's TypeScript form, `@qi/market`:
`market` 1.1.0's K-line (`index`, `date`, `open`, `high`, `low`, `close`, `volume`) for a complete one, and its ongoing
K-line (those, and `asOf`) for the one still forming. The caller reads them from their JSON with the contract's own
codec (`decodeAs(klineSchema, text)`, `decodeOngoingKLine(text)`) and gives the library the records. How they reach
the caller is the caller's, and so is how it uses the two components; the library's README gives an example (Using
it): the batch first, then the online component.

## The online component

### What it starts from

`online(c)` gives `Result<Online, OnlineError>`, from a chart's components `c` as the batch takes them: its x-axis
market's K-lines, at least one, and no 缠论 data (Which components are online); its add-ons drawing with series only.
An `Online` is a plain record: `components`, the chart so far as the batch takes it, and `forming`, the ongoing K-line
drawn as the last one, or none.

### At each update

The next index is the one after the last complete K-line.

| Call | Given | What it does |
|---|---|---|
| `complete(o, k)` | a K-line at the next index | the forming one completed (its date the forming one's); with none forming, a new K-line appended (its date after the last) |
| `forming(o, k)` | an ongoing K-line at the next index | the forming one replaced (its date the same, its `asOf` not before the forming one's); with none forming, appended as forming (its date after the last) |

Each gives `Result<Step, OnlineError>`: a step is the chart's new state and `from`, the position the update changed,
the forming one's when it is replaced and the new one's when one is appended. Each rule above is a fault of its own
(`OnlineError`'s codes: the index; the date not after the last; the date not the forming one's; `asOf`), and so are a
K-line the batch refuses (one code, its message the batch's rule: its index, its date, its prices) and an add-on's
rule (Which components are online). On a fault the chart is as it was.

The change, for the page, is each engine's page data where the update changed it, made by the batch's functions:

- `tvTail(step)`, the tv page data's tail (`qi-chart-tail/1`): the position the step changed, and each series' items
  from a time, the candles' and the volume's from `from`'s, each add-on's series whole;
- `d3fcTail(step)`, the d3fc page data's tail (`qi-d3fc-tail/1`): the times from `from`, the candles' and the volume's
  layers' items from it, each add-on's layer whole.

`tvApplied(chart, tail)` and `d3fcApplied(chart, tail)`, pure, give the page data with a tail applied. The engine's
script applies a tail, `UPDATE(tail)`, a handle the script gives the page as it gives `REDRAW`.

## Which components are online

| Component | Online in 2.0.0 | Its change at an update |
|---|---|---|
| K线, 成交量 | yes | the changed K-line's own candle and bar |
| the caller's add-ons (kind 1) | yes, those drawing with series | each made again from every K-line; its change, its series whole |
| 缠论's configurations (包含, 分型, 笔, 线段, 走势, 中枢) | no | later (Where the structure enters) |
| 成交量分布 (kind 2) | no | it is made from the structure |
| marks (`MARKS`, `MARKING`) | as on a static page, at the K-lines drawn | none: an update does not change them |

**An add-on online** is made again whole at each update, its derive over every K-line, and its series are replaced
whole: so the online chart's add-ons are those of its K-lines drawn whole, whatever values the add-on gives, and no
rule of how its values depend on the K-lines is needed. It draws with the `series` primitive only: a box, a line or a
mark of an add-on would need a drawn kind of tv replaced too, which no add-on of the app draws. Since its primitives are
made at every update, the rule is checked by `online` and at every update; an update at which an add-on gives another
primitive is refused, the chart as it was.

**What an update costs.** A tail is cut from the batch's page data of the whole chart after the step, made by the
batch's own functions (`tvChart`, `d3fcChart`), so that the page data with every tail applied is the batch's by
construction: each update makes the page data of every K-line again, its schemas' checks and the add-ons' derive among
them, O(n) in the K-lines. Measured by the check in headless Chromium, with MA5, MA10, MA30 and MACD, the online
component's step and the engine's `UPDATE` (d3fc's drawing, on the next frame, not counted): about 110 ms an update for
4,000 K-lines (tv; 100 ms d3fc), 0.4 ms for 60; the check reports it with its frame drawn too. Lightweight Charts' own
`update` rebuilds a series' items over all its rows too (`docs/research/chart-online-2026-10-24.md`, 1a). Drawing only
what an update changes (K线's and 成交量's one K-line, an add-on's step, `step(state, K-line)`, O(1)) is left for a
later version: an add-on's step would write each indicator twice, its whole form for the batch and its step,
a second home for one value, which may round otherwise (MACD's powers, `design-chart-lib-2026-10-24.md`, Version 1.7,
step 2).

## The engines

**tv.** At `UPDATE(tail)`, the candles' and the volume's series each get the item at `from` by `series.update`: an
equal time replaces the last item, a later one appends (`docs/research/chart-online-2026-10-24.md`, 1a). Then each
add-on's series gets its items by `setData`, after the candles, so that its times are on the time scale already. The
view is Lightweight Charts' own: a new bar shifts the view while the last one is in view (`shiftVisibleRangeOnNewBar`,
on by default), and the view is held when scrolled back (1c). A chart of one K-line given its second is drawn again
whole, at the view the rule gives: Lightweight Charts weighs a series' first time, and so labels it, only when it is
given more than one time at once (found by the check: begun with one, the first label was the second K-line's).

**d3fc.** At `UPDATE(tail)`, the page data with the tail applied (`d3fcApplied`). An append while the last K-line is
in view moves the x domain one place on; otherwise the domain is held. The chart is drawn again from its page data, as
d3fc draws (`docs/research/chart-online-2026-10-24.md`, 2), at that view, on the next animation frame, so several
updates in one frame cost one drawing; the price axis is fitted to the K-lines in view, as at every redraw, and the
shapes in view are found by their places as now (`design-engines-2026-10-24.md`, d3fc). The page's pointer callbacks
are given to the chart drawn again once it has laid out its panes, a frame later, so a legend placed by the panes is
placed as on the whole page (found by the check: given at once, a subgraph's legend was placed at the top).

**Both.** Each engine's script keeps its page data with every tail applied, so `REDRAW` and `CHART_UI` reach the chart
as it is now. What a script derives from the whole page data when it draws (whether the K-lines are daily, and so how
the times are labelled; the ticks) is derived again from it after an update, so that a chart begun with one K-line is
labelled as the whole is. The legend's K-line, when the pointer is not on the chart, is the last one again after an
update. `UPDATE` is typed in `src/handle.ts` with the other handles. A tail not the engine's (its contract), or whose
`from` is past the K-lines drawn, is a fault on the console and is not drawn; the library makes a tail only from a step
it took. The TikZ engine has no online path: a picture is static.

## Where the structure enters

No published product gives the structure one K-line at a time, so its updates are not designed here. It will enter at
three places: the components the online component starts from, with the structure of the K-lines drawn; each update,
with the structure's change, given by the caller with the K-line; and the tails, with the configurations' layers.
成交量分布 enters with it.

## What 2.0.0 holds, and what is left

2.0.0 holds:

- the batch component as 1.8's (guarantee 1), market's K-line in place of the plain bar as an input;
- the online component: `online`, `complete`, `forming`, the tails and their `applied`, and `UPDATE` in both browser
  engines, for K线, 成交量 and the caller's add-ons drawing with series;
- `@qi/market` 1.1.0, taken by a flake input `market` (`github:zhifengzhang-sz/qi-v2-contracts?ref=market-1.1.0`, its
  package `market-ts`), linked at `dev/ts/node_modules/@qi/market` and copied into the package `qi-chart`, as
  `@qi/chanlun` is; a row for it in `PRODUCTS.md`'s Takes;
- the library's README: in Using it, the online component and an example of the two components used, the batch first,
  then the online one; its Changes entry for 2.0.0.

Left, each for a version of its own:

- the structure online, and 成交量分布 with it: no published product gives it yet;
- drawing only what an update changes, O(1) an update (an add-on's step among it) (What an update costs);
- an add-on's boxes, lines and marks online: until an add-on asks for them;
- dates finer than a second, which the contract allows: both engines' page data hold seconds, and a later version
  takes such dates, every part taking the contract whole (`docs/decisions.md`, 2026-11-08);
- the batch's `chanlun` 1.1.0, kept as the input of the app's static charts while the app keeps them
  (`docs/decisions.md`, 2026-11-08): gone in version 3 (`design-chart-chanlun-3-2026-11-09.md`).

## How the release is checked

The commits these checks name, the 1.8 code's, which recorded the hashes, and the one tagged `qi-chart-2.0.0`, are of
the earlier history, which this repository does not hold; its history begins at 2.0.1's tree (`docs/decisions.md`,
2026-11-08).

Before 2.0.0 is published, each check in the role `checker`:

1. **The online component's law**, as property tests (fast-check, in `make ts`): for any components of market
   K-lines and any sequence of `complete` and `forming` within the rules, the batch's page data of the components
   started from, with every tail applied, is the batch's page data of the components ended with, in both engines, with
   add-ons. For each rule, an update that breaks it is refused with its fault. A price is read back exactly at its
   scale, and one finer than the scale is refused.
2. **The static charts, byte for byte.** Before the first change of the library's or the app's code, the 1.8 code
   writes each static chart's page data and TikZ picture, and each static page's screenshot in headless Chromium at a
   fixed size. The charts: every set `results.lock` names, at all levels, at level 0 and at level 1, as `make
   chart-check` draws them, its picture and marks too; and the test data's bars alone. Their sha256 are kept in a
   tracked file, and making them twice gives the same, which shows the screenshots are steady. 2.0.0's are then the
   same. Where the test data changes, the hashes it changes are made again by the code of the release before, on the
   new data, and the new release's are then the same: for 2.0.1, the two screenshots of the bars alone, whose toolbar
   shows the request's source, made by 2.0.0's code. Not covered: settings, ranges, marks and levels other than those, and any CSV of bars and request but the test
   data's; for them guarantee 1 rests on the batch's functions being unchanged and on the app's bars being made as 1.8
   makes them, which the build's review reads in its diff.
3. **The online component in a browser.** The chart app's online page of the test data (What changes for the chart
   app), in both engines, in headless Chromium: the replay runs to its end with no exception; each engine's page data
   then is the page data of the static page of the same K-lines, both made by the same browser; its screenshot is the
   static page's at the same view; the view follows while the last K-line is in view and holds when scrolled back; a
   replay begun with one K-line ends drawn as the whole is; an update's cost is reported.
4. **The package as a taker takes it** (`make qi-chart-package`): the taker's script draws a chart by the batch and
   steps it by the online component, from the package alone.
5. **The release itself.** `make verify VERIFY=--all` and the checks above pass, and one review is made in the role
   `reviewer`. Then one commit holds the version 2.0.0 (in `dev/ts/lib/chart/package.json`, the flake's `qi-chart`,
   `PRODUCTS.md` and the README's Changes) with this design's state and the session's documents. It is tagged
   `qi-chart-2.0.0` and pushed with its tag, and nothing is committed after.

## What changes for the chart app

- It takes `@qi/chart` 2.0.0. Its static charts are as they are, on `chanlun-results` 0.2.0 and `chanlun` 1.1.0, their
  page data and pictures 1.8.0's (guarantee 1); its pages differ only by the code they carry. (Since version 3 it takes
  no results: `design-chart-chanlun-3-2026-11-09.md`, The chart app.)
- Its bars alone are given to the batch as market's K-lines made from its run's bars as the run holds them (`in.csv`,
  `src/input.ts`'s `barsFile`: the date in seconds, the prices at the request's scale, the volume a whole number):
  each an index from 0, its date in milliseconds, its prices as decimals at the scale, its volume that whole number.
  So the bars are 1.8's, and the page data with them.
- It gains an online page: a replay of a run of bars, its CSV (`make chart INPUT= REQUEST= ONLINE=N`), in
  both engines. All but the last N K-lines are drawn by the batch; then each of the last N comes to the online
  component as ongoing K-lines that reach its values, then its complete K-line, all market's records made from the
  app's bars. Why: the online component needs a caller in a browser for its check (How the release is checked, 3) and
  for being looked at in both engines on the same view, as every page is. The app is the adapter from a producer to the
  contracts, and the replay's source is the app's own, so the library still knows none.
- Its page's controls and settings work on the online page: a change of the settings draws the chart again by the batch
  from the online component's components so far, not from the page's input.
- It takes `@qi/market`, for its K-lines' records.

## What the earlier Versions, 2, gave

`design-chart-lib-2026-10-24.md`, Versions, 2, as it stood: each component's derive a step, start-up the same step over
the history, its change the items from the first it revises, only the unconfirmed tail ever replaced, each engine
redrawing from the change and following the newest K-line only while it is in view.

- Kept: the change from the position the update changed (`from`); each engine redrawing from it; the view's rule.
- Changed: start-up is no step over the history: the batch draws the chart, and the online component starts from its
  components. The batch's functions make every tail too, so guarantee 2 holds by construction.
- Lost, for now: O(1) an update. Each tail is cut from the batch's page data of the whole chart, so an update costs
  O(n) in the K-lines (What an update costs).
- Not designed here, with the structure: the unconfirmed tail, and the test of whether 成交量分布 can be done at the
  app's level.
