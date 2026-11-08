// The chart's pages, each one HTML file needing no network, its libraries inlined. Each carries its input (INPUT,
// describe.ts) and the app's script for the browser (the bundle of src/edge/browser.ts), which makes the engine's
// description from it there (Version 1.7, step 2), then the engine's script draws it: by the tv engine, TradingView's
// Lightweight Charts (its standalone build) and @qi/chart's engine/tv.ts, TradingView's attribution kept on the chart
// as its licence asks; by the d3fc engine, D3 and d3fc (their browser bundles) and engine/d3fc.ts. Each page also
// gives the palette and PERIODS, its 周期 (periods.ts); and MARKS, its marks (qi-marks/1, marks.ts), where it has them.

import type { Json } from "@qi/base";
import type { Marks } from "@qi/chart";
import type { PageInput } from "./describe.ts";
import type { Periods } from "./periods.ts";

const escapeHtml = (s: string): string =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

// JSON inside a script: no "</script>" can close it early
const inScript = (v: Json | PageInput | Periods | Marks): string =>
  JSON.stringify(v).replaceAll("<", "\\u003c");

// the page's frame: the toolbar (the title, the controls, the source) over the stage, the chart and its legend on it;
// the controls' and the legend's own look is the app's script's (src/edge/ui.ts)
const style = [
  "html,body{margin:0;height:100%}",
  'body{display:flex;flex-direction:column;font-family:"Noto Sans SC","PingFang SC",system-ui,sans-serif;font-size:13px}',
  "#bar{display:flex;flex-wrap:wrap;gap:2px 6px;align-items:center;padding:3px 10px;min-height:34px;border-bottom:1px solid rgba(128,128,128,0.25)}",
  "#bar h1{font-size:14px;font-weight:600;margin:0 8px 0 0;white-space:nowrap}",
  "#source{opacity:0.5;margin-left:auto;font-size:11px}",
  "#stage{flex:1;position:relative;min-height:300px}#chart{position:absolute;inset:0}",
  "#legend{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden}",
].join("\n");

// the page's data, read by the app's script (INPUT, ENGINE: properties of the page's global, which a script's const is
// not) and by the engine's (PALETTE, PERIODS); MARKS, read by the app's script, then by the engine's
const data = (
  input: PageInput,
  engine: "tv" | "d3fc",
  palette: Json,
  periods: Periods,
  marks: Marks | undefined,
): string =>
  `<script>globalThis.INPUT = ${inScript(input)};\nglobalThis.ENGINE = "${engine}";\nconst PALETTE = ${inScript(palette)};\nconst PERIODS = ${inScript(periods)};${marks === undefined ? "" : `\nglobalThis.MARKS = ${inScript(marks)};`}</script>`;

// the app's script, inlined, which gives the engine's script its description
const script = (bundle: string): string => `<script>${bundle.replace(/<\/script/gi, "<\\/script")}</script>`;

export const page = (c: {
  readonly input: PageInput;
  readonly bundle: string;
  readonly source: string;
  readonly palette: Json;
  readonly periods: Periods;
  readonly marks?: Marks | undefined;
  readonly lib: string;
  readonly engine: string;
}): string =>
  [
    "<!doctype html>",
    '<html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(c.input.title)}</title>`,
    `<style>\n${style}\n</style></head><body>`,
    `<div id="bar"><h1>${escapeHtml(c.input.title)}</h1><span id="tools"></span>`,
    `<span id="source">${escapeHtml(c.source)}</span></div>`,
    '<div id="stage"><div id="chart"></div><div id="legend"></div></div>',
    "<!-- TradingView Lightweight Charts 5.2.1, Apache-2.0, https://www.tradingview.com/ (its LICENSE in the flake's package lightweight-charts) -->",
    `<script>${c.lib}</script>`,
    data(c.input, "tv", c.palette, c.periods, c.marks),
    script(c.bundle),
    `<script>${c.engine}</script>`,
    "</body></html>",
    "",
  ].join("\n");

// the d3fc engine's page: the same bar, the chart an SVG of D3 and d3fc
export const d3fcPage = (c: {
  readonly input: PageInput;
  readonly bundle: string;
  readonly source: string;
  readonly palette: Json;
  readonly periods: Periods;
  readonly marks?: Marks | undefined;
  readonly d3: string;
  readonly fc: string;
  readonly engine: string;
}): string =>
  [
    "<!doctype html>",
    '<html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(c.input.title)}</title>`,
    `<style>\n${style}\n</style></head><body>`,
    `<div id="bar"><h1>${escapeHtml(c.input.title)}</h1><span id="tools"></span>`,
    `<span id="source">${escapeHtml(c.source)}; drawn by d3fc</span></div>`,
    '<div id="stage"><div id="chart"></div><div id="legend"></div></div>',
    "<!-- D3 7.9.0, ISC, https://d3js.org/; d3fc 15.2.13, MIT, https://d3fc.io/ (in the flake's package d3fc) -->",
    `<script>${c.d3}</script>`,
    `<script>${c.fc}</script>`,
    data(c.input, "d3fc", c.palette, c.periods, c.marks),
    script(c.bundle),
    `<script>${c.engine}</script>`,
    "</body></html>",
    "",
  ].join("\n");
