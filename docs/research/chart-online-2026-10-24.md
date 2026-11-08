> Copied with `@qi/chart` and the chart app at version 1.8 (`docs/decisions.md`, 2026-10-28). It describes the code as copied, version 1.8. Version 2 is written here.

# Online mode (one K-line at a time) in Lightweight Charts v5.2.1 and d3fc: research notes, 2026-10-24

Sources and how each was read. [READ] = read in full at the lines cited; [SUMMARY] = from a search/fetch summary only; [INFER] = my inference.
- LWC source, `/home/zzhang/dev/chart/lightweight-charts` (v5.2.1). Paths below are under `src/` unless named. [READ] at the lines cited. Nothing was run.
- LWC docs and examples in the same clone: `website/docs/plugins/series-primitives.mdx`, `website/tutorials/demos/realtime-updates.js`, `plugin-examples/src/plugins/`. [READ] in part (lines cited).
- d3fc: `github.com/d3fc/d3fc`, shallow clone read locally (HEAD 55ee594, 2024-07-30; `d3fc-series` 6.1.3, `d3fc-webgl` 3.2.1; the repo is independent-versioned, I found no "15"). Examples and package sources [READ] at the lines cited. The d3fc.io site: `/examples/streaming/` returned 404; the example source is in the repo. No d3fc.io page read.
- Known before these notes, and not repeated: the update flow `updateSeriesData` -> `_sendUpdateToChart` -> `lightUpdate` -> one rAF, and the invalidation levels; the `DataLayer` response idea; the `historicalUpdate` defect at `data-layer.ts:415-421`.

## Summary, one line per question

1a. LWC: `update` replaces the last bar on equal time, appends on later time, throws on earlier; `historicalUpdate: true` replaces any existing bar (throws if no bar at that time); the change is described as `firstChangedPointIndex` (-1 when no new time point) plus the series' whole row array; the redraw is a Light invalidation, but the series' items are rebuilt over ALL rows each update (O(n) per tick).
1b. LWC: a primitive gets no incremental hook; it gets `updateAllViews()` on every Light/Full redraw, may call `requestUpdate()`, and learns of data only by `series.subscribeDataChanged` with scope `'full' | 'update'` (no index, no bar). A custom series gets `update(PaneRendererCustomData, options)` with all the data for the visible range, not a delta.
1c. LWC: a new bar shifts the view with it when the last bar is visible (`shiftVisibleRangeOnNewBar`, default true); when the user has scrolled back, the right offset is compensated so the view stays put.
1d. LWC: markers are replaced as a whole list (`setMarkers`), no incremental API; the last-price line is recomputed each redraw; no cost notes found beyond conflation and "historicalUpdate is slower".
1e. LWC examples that stream: only `setInterval` + `series.update` (docs' realtime demo, `partial-price-line`, `expiring-price-alerts`, `accessibility`); none streams a revisable structure.
2. d3fc: no incremental update at all; the chart is an idempotent function of the data, and the streaming examples push, shift and call the chart again; the canvas and WebGL series rebuild their draw from the whole array each render (WebGL re-uploads the whole buffer when the data changes); no culling or progressive rendering found; `d3fc-sample` is a separate down-sampling helper.
3. Comparison below: LWC is append-or-replace-last plus a slow, opt-in historical replace; d3fc is replace-everything. Neither has a notion of "revise the last k items"; a host must provide it (section 3).

## 1. Lightweight Charts v5.2.1

### 1a. `update` versus `setData`

- API contract, in the tsdoc: time must be greater than or equal to the latest; equal replaces the latest. `api/iseries-api.ts:164-190`. `historicalUpdate` "will be slower" (170-171). [READ]
- `SeriesApi.update` checks value types, calls `updateData`, then fires `dataChanged('update')`. `api/series-api.ts:158-163`. `setData` checks order, calls `applyNewData`, fires `'full'` (150-156). [READ]
- The rules, all in `model/data-layer.ts` `updateSeriesData`, 247-336 [READ]:
  - earlier than the series' last time and not historical: throws (262-265);
  - historical with no point at that time: throws (269-271); historical with conflation on: throws (249-251);
  - equal time: `isLastBarUpdate` (289-292) and `_updateLastSeriesRow` overwrites the last row (385-407; 399-400 overwrite, 396 push, 402 whitespace removes it);
  - historical: `_updateHistoricalSeriesRow` (296-297, 409+).
- The change it computes: `_getUpdateResponse` (512-544) [READ]. If the time point already exists on the time scale (`affectsTimeScale` false, 279), `firstChangedPointIndex = -1` and only the updated series is in the response, with its row array (539-543). If the time is new, it splices into `_sortedTimePoints` (327), reindexes from the insert point (329-331), and the response carries EVERY series' whole row array, the whole points array and `firstChangedPointIndex` (516-534; the TODO at 514 says it could be narrowed). The change is therefore "from index k" plus whole arrays, not a delta of rows.
- Applying it: `api/chart-api.ts:411-424` (`_sendUpdateToChart`) [READ]: `invalidatePaneViewData` per series, `updateTimeScale`, `series.setData(rows, info)`, `recalculateIndicesWithData`, `recalculateAllPanes`.
- `Series.setData` (`model/series.ts:277-305`) [READ]: `PlotList.setData` keeps the array and rebuilds the index list and clears the row-search and min/max caches (`model/plot-list.ts:112-116`); clears the conflation cache; `invalidatePaneViewData` (`_paneView.update('data')`, 308-310); updates the last-price animation if `lastBarUpdatedOrNewBarsAddedToTheRight` (285-287); then `updateSource` and `lightUpdate` (302-304).
- What is redrawn: a Light invalidation of the pane (`chart-model.ts:561-564`, `_invalidationMaskForSource` default Light, 1236-1243), coalesced to one rAF. Not partial in the image: the whole pane and the time axis are repainted. Partial exists only in how much recomputation runs, below.
- Cost visible in the code [READ, INFER for the order of cost]: `SeriesPaneViewBase._makeValid` (`model/series/series-pane-view-base.ts:83-108`) rebuilds the raw items when `_dataInvalidated`: `_fillRawPoints` maps over ALL rows (`model/series/line-pane-view-base.ts:42-44`; `custom-pane-view.ts:161-173`), then the visible range is converted to coordinates. So each `update` costs O(n) in the series length for the item rebuild plus O(n) for `PlotList.setData`'s `indices` map, even for a replace-last. It is a cheap O(n) (array maps), and conflation (`enableConflation`, a time-scale option, `model/time-scale.ts:241`; `updateLastConflatedChunk` for the last-bar case, `data-layer.ts:299-301`, `series.ts:380-413`) is the library's own answer for very large series. Release notes: `website/docs/release-notes.md:81-92`. I did not measure anything.

### 1b. Primitives and custom series

- `ISeriesPrimitiveBase` has `updateAllViews?()` ("called when viewport has been changed, so primitive have to recalculate / invalidate its data"), `attached?(param)` with `requestUpdate`, `paneViews`, `autoscaleInfo` etc. `model/iseries-primitive.ts:56-60, 132-135` [READ]. Docs: `website/docs/plugins/series-primitives.mdx:120-147` [READ]: the primitive updates its views in `updateAllViews()`; it calls `requestUpdate` to ask for a redraw.
- `Series.updateAllViews` (`model/series.ts:595-607`) calls every primitive wrapper's `updateAllViews` (606) [READ]; it is reached from `updateSource` -> pane `updateAllSources` (`model/pane.ts:294-298`) on every Light redraw, including every data update.
- There is NO incremental hook: no `onBarAppended`, `onLastBarChanged`, no index or bar passed. `grep requestUpdate` in `src` finds only plugin code. [READ by grep]
- How a primitive learns of new data: `series.subscribeDataChanged(handler)` (`api/iseries-api.ts:244, 255`), handler gets only `'full' | 'update'` (`api/iseries-api.ts:25`). The plugin base class does exactly this and exposes `dataUpdated?(scope)` plus `requestUpdate()` (`plugin-examples/src/plugins/plugin-base.ts:15-40`). The built-in markers primitive subscribes too (`src/plugins/series-markers/primitive.ts:37, 70`). To see which bar changed, the primitive reads `series.data()` / `dataByIndex` itself and diffs. [READ; the diff remark is INFER]
- Custom series: `ICustomSeriesPaneView.update(data, options)` is called with the whole `PaneRendererCustomData` (bars with their visible range) when the view is made valid; the renderer then draws all visible bars (`model/series/custom-pane-view.ts`, `_fillRawPoints` 161-173) [READ in part]. No delta.
- Both are "pull" designs: the library asks the primitive to refresh its view-model on each redraw; the primitive caches what it can by its own keys. The markers primitive shows the pattern: `_dataInvalidated` rebuilds the items; a cheap pass over only the visible range recomputes coordinates (`src/plugins/series-markers/pane-view.ts:189-260`, `visibleTimedValues` at 247).

### 1c. Time scale on append

- `ChartModel.updateTimeScale` (`model/chart-model.ts:953-982`) [READ]: before applying the new points it takes the old visible strict range; `isLastSeriesBarVisible = visibleBars.contains(currentBaseIndex)` (old base index); if bars were added on the right and no shift is wanted, it subtracts the shift from the right offset (979-981), so the screen position of the existing bars is unchanged; else the right offset stays and the view slides with the new bar. `needShiftVisibleRangeOnNewBar = isLastSeriesBarVisible && ... && shiftVisibleRangeOnNewBar` (976).
- So: last bar in view and option on (default true, `api/options/time-scale-options-defaults.ts:17`; doc `model/time-scale.ts:165-171`): the view follows. Scrolled back so the last bar is not visible: the view is held (compensation). Option off: the view is held even at the live edge.
- Replacing a whitespace point does not shift unless `allowShiftVisibleRangeOnWhitespaceReplacement` (default false, `model/time-scale.ts:173-178`).
- The user can return to live with `timeScale().scrollToRealTime()` (used by the realtime demo button, `website/tutorials/demos/realtime-updates.js:173`).
- Replacing the last bar (same time) changes no base index, so nothing shifts. [INFER from `isSeriesPointsAdded = newBaseIndex > currentBaseIndex`, 969]
- `TimeScale.update` (`model/time-scale.ts:850-855`): `_tickMarks.setTimeScalePoints(points, firstChangedPointIndex)` recomputes tick marks only from the changed index. This is the one place `firstChangedPointIndex` is used incrementally. [READ; "only from" is INFER from the parameter name, I did not read `tick-marks.ts`]

### 1d. Markers and price lines on update

- Markers: `setMarkers(markers)` replaces the whole list and recalculates all (`src/plugins/series-markers/primitive.ts:80-83, 174`); there is no `addMarker` / update-one. A marker at the live bar must be set again with the full list. Cost is O(markers) per call, plus the per-redraw pass over the visible ones. [READ]
- Price lines: the series' last-price line and axis label are views updated in every `Series.updateAllViews` (`series.ts:603-604` `_priceLineView.update()`, `_baseHorizontalLineView`), so they follow the last bar at no extra code. Custom price lines (`createPriceLine`, `series.ts:312+`) are fixed-price objects, updated in the same pass (`series.ts:599-601`). The last-price pulse animation is triggered by a data update (`series.ts:285-287`; the animation view uses `setTimeout`/timing, `views/pane/series-last-price-animation-pane-view.ts`). [READ]
- Cost notes for many updates per second: none stated. What the code gives: paint is coalesced to one rAF per frame, so several `update` calls within a frame cost one paint but each still runs its data-layer work, the O(n) `setData` and cache clearing at once. [INFER]

### 1e. Streaming examples

- Docs' real-time demo: `website/tutorials/demos/realtime-updates.js` [READ in part, lines 21-70 and 123-129, 173]: it generates candles with 5 updates per candle (`updatesPerCandle = 5`), emits each as `series.update(...)` on a `setInterval`; the in-progress candle is the same `time` re-sent with new high/low/close; history is `setData` first, then `fitContent` (111). A button calls `scrollToRealTime`.
- Plugin examples [READ by grep + partial]: `partial-price-line/example/example.ts:36-42` and `expiring-price-alerts/example/example.ts:103-109` call `lineSeries.update` on a 200 ms interval; `expiring-price-alerts.ts:56` subscribes `subscribeDataChanged` to check crossings on each tick; `accessibility/example/example.ts:121-143` streams a point every 3 s. None of the plugin examples streams a structure that revises earlier items.
- `volume-profile` and `up-down-markers-plugin` (`wrapper.ts:54-90`, `primitive.ts:149-172`) pass through `historicalUpdate` but I did not read how they use it.

## 2. d3fc

- No incremental update. The repo's own words in the idempotent example: the render function "should be an idempotent transformation of the data. As a result, if the data changes the entire render function is re-evaluated" (`examples/idempotent-streaming-chart/README.md`). It calls this the "extreme" case, because components are recreated each render and cannot keep caches; "where possible retain references to components that are re-used". [READ]
- Streaming examples [READ]: `examples/streaming-chart/index.js:18-30`: on a 200 ms timer, `data.push(stream.next()); data.shift();` set the x and y domains from the extents of the window, `d3.select('#chart').datum(data).call(chart)`. A sliding window of 110 bars, SVG series; README says use canvas or WebGL for performance. `idempotent-streaming-chart/index.js:5-37` additionally recomputes the Bollinger indicator over the whole array and rebuilds the chart on each tick (indicators are whole-array functions, `fc.indicatorBollingerBands()(data)`). The README links "Streaming Chart in React/Angular/Svelte" ([SUMMARY] from the repo README page; not read).
- View under append: in the streaming example the x domain is recomputed from the data window each tick, so there is no user view to keep. For zoom, `d3fc-zoom` (`examples/chart-d3fc-zoom/index.js:18-46`) mutates the x and y scales' domains and re-renders on a `'zoom'` event; the domain is the state. I found no example that combines zoom with appended data, and no code that keeps a zoomed domain when data grows; the caller would hold the domain and decide whether to extend it. [READ; the last clause is INFER]
- Redraw cost [READ]: the canvas series filter and loop the whole data array each render (`packages/d3fc-series/src/canvas/ohlcBase.js:10-13`: `data.filter(base.defined())` then `forEach`); no visible-range culling in what I read. WebGL: `d3fc-webgl/src/buffer/attributeProjector.js` marks the attribute dirty on any `.data(...)` call (88-94) and rebuilds the typed array over all data (`projector()` 14-44), then `gl.bufferData(..., DYNAMIC_DRAW)` re-uploads it (`buffer/attribute.js:14-21`). Not incremental; clean buffers are skipped when nothing changed (`attribute.js:14`). Redraws of `d3fc-element` charts are batched to one rAF (`d3fc-element/src/requestRedraw.js:5-14`). Down-sampling for large data is the separate `d3fc-sample` (LTTB, mode-median; `packages/d3fc-sample/README.md`), applied by the caller before the series. No progressive rendering found (grep for progressive/incremental/cull in `packages/*/src` and READMEs: nothing relevant).
- The repo's last commit is 2024-07-30 (clone), so activity is low. [READ]

## 3. Comparison and what a host library needs

Plainest finding: LWC supports exactly two online operations on a series (append, replace the last); d3fc supports none and redraws from the whole data. Neither has revise-recent-items, so our host must supply it.

| need | LWC | d3fc | host must provide |
|---|---|---|---|
| append | `update` with later time; new time point reindexes and sends all rows | push to array, re-render | an append op that says "from index k" |
| replace last (forming bar) | `update` with equal time; cheap path (`firstChangedPointIndex = -1`) | same as any change | a replace-last op distinct from append |
| revise earlier items | refused unless `historicalUpdate`, one bar at a time by an existing time, "slower" | the array is the truth, any change allowed | a revise-from-k op: drop items from k, add the new ones; one call, not item by item |
| keep the view | by right-offset compensation when the live edge is not visible; follow when it is; option and `scrollToRealTime` | caller holds the scale domains | the view as state (range plus offset), with a follow-the-live-edge rule |
| redraw cost | rAF-coalesced; O(n) rebuild of items per update; conflation for huge n | O(n) per render; WebGL re-uploads whole buffer; sample before | work proportional to the changed tail, and only the visible range drawn |

How structure drawings that revise recent items cope in LWC (the question in 3). [INFER from the code above, nothing run]
- The library refuses to revise the past, so a primitive that draws strokes/segments/boxes must keep its OWN model and own the revision: it receives `'update'` from `subscribeDataChanged`, reads the series, recomputes its structure from its own state, and calls `requestUpdate`. Its `updateAllViews()` then turns its structure into pixel views. The library never tells it which bar changed; it must keep the last seen time/length to detect a replace versus an append.
- A revision of earlier structure never goes through `series.update`; it is a primitive-side replace (the markers primitive's `setMarkers` is the example: replace the whole list). The price bars underneath only append or replace-last, so only the derived layer revises, which matches our case (K-lines are append/replace-last; the structure above them changes its last items).
- The cost of that is on the primitive: LWC does no diffing for it.

Suggested contract for our library (a proposal, not a finding; for the owner to decide):
1. Two input operations on the K-lines: `append(bar)` and `replaceLast(bar)`; the host (not the chart) computes `[firstChangedIndex, newItems]` for every derived series and structure, as `DataLayer` does for the series (an update's response as a full new value), and gives the chart ONE change value per tick: `{ truncateFrom: k, items: [...] }` per component.
2. A confirmed/unconfirmed boundary per structure (items before it never revise), so a component can keep a cache of confirmed drawing data and rebuild only the unconfirmed tail. LWC has nothing like this; I found no source for it in either library.
3. View state as a value: follow-live iff the last bar was visible before the change (LWC's rule, `chart-model.ts:968-981`), else hold.
4. One redraw per frame (both libraries coalesce to rAF).
5. For the draw: cull to the visible range before building drawing data (LWC does this per redraw in the markers pane view, `pane-view.ts:247`, but still rebuilds raw items over all rows; do better by working from the changed index).

## Not established

- No performance numbers for LWC or d3fc: nothing was run; "O(n) per update" is from reading the maps, not measured. I did not find an LWC statement of updates per second limits.
- LWC: did not read `tick-marks.ts`, `_updateHistoricalSeriesRow` in full (409+), `DataConflater`, the custom-series `update` call chain beyond `custom-pane-view.ts:161-173`, the line renderer's culling, nor the e2e tests; how `volume-profile` and `up-down-markers-plugin` use `historicalUpdate`.
- d3fc: the "15" in the brief: I found no d3fc version 15 (packages are independently versioned, `lerna.json`); I read the master clone of 2024-07-30. Not read: the d3fc.io pages (the one tried was 404), the React/Angular/Svelte streaming examples, `d3fc-chart`/`d3fc-element` redraw internals beyond `requestRedraw.js`, and whether any canvas series culls (I read only `ohlcBase.js`).
- No source for a confirmed/unconfirmed (revisable-tail) pattern in either library; the mapping to our strokes/segments/boxes is my inference.
