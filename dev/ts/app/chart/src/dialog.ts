// The page's settings dialog, its pure part (docs/designs/design-chart-lib-2026-10-24.md, Version 1.7, step 3): from
// the settings a page carries (every value, as everyValue writes them), a section for each component, the library's
// (K线, 成交量, 包含, 分型, 笔, 线段, 走势, 中枢, 成交量分布), the layout, each average and MACD, with a field for each of
// its values: a number, a colour of the palette (a name, cl-…), a choice of two (a boolean) or a text. A value set at
// its path gives new settings, the others as they were. The static picture's (picture) is the command's, not the
// page's: no section. The page's script (src/edge/browser.ts) shows them, and draws the chart again from the new
// settings.

import type { Json } from "@qi/base";

export type Path = readonly (string | number)[];
export type Field = {
  readonly path: Path;
  readonly label: string;
  readonly kind: "number" | "colour" | "boolean" | "text";
  readonly value: number | string | boolean;
  // what it is of: a parameter (what derive takes), a style (what draw takes), or the layout's
  readonly group: "params" | "style" | "layout";
};
export type Section = { readonly key: string; readonly name: string; readonly fields: readonly Field[] };

// the library's components by their keys, as the page names them
const names: Readonly<Record<string, string>> = {
  candles: "K线",
  volume: "成交量",
  merged: "包含",
  fx: "分型",
  bi: "笔",
  duan: "线段",
  zoushi: "走势",
  zhongshu: "中枢",
  profile: "成交量分布",
  layout: "布局",
};

const isObject = (v: Json | undefined): v is { readonly [key: string]: Json } =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// a value's name in the page, by its key; a key not here is shown as it is
const labels: Readonly<Record<string, string>> = {
  show: "显示",
  detail: "仅放大时显示",
  showBox: "显示方框",
  showMarks: "显示标记",
  showOuter: "显示外框",
  showInner: "显示内框",
  showDiff: "显示 DIFF",
  showDea: "显示 DEA",
  showBars: "显示柱",
  period: "周期",
  colour: "颜色",
  width: "宽度",
  up: "上涨",
  down: "下跌",
  opacity: "不透明度",
  height: "高度",
  fill: "填充",
  mark: "标记大小",
  flat: "持平",
  size: "大小",
  step: "每级加宽",
  inner: "内框填充",
  rows: "行数",
  share: "宽度占比",
  digits: "小数位",
  fine: "细节的K线数",
  above: "上边距",
  below: "下边距",
  subgraph: "副图高度",
  levels: "级别颜色",
  dash: "虚线（实，空）",
  font: "字号",
  offset: "右侧留白（K线）",
  fast: "快线",
  slow: "慢线",
  signal: "信号线",
  diff: "DIFF",
  dea: "DEA",
};

// every value under `v`, a field each, its path from the settings' root, its label its key's name (a list's, with the
// item's number)
const fields = (v: Json, path: Path): readonly Field[] => {
  const key = path.findLast((k) => typeof k === "string") ?? "";
  const last = path[path.length - 1];
  const label = `${labels[key] ?? key}${typeof last === "number" ? ` ${last}` : ""}`;
  const group = path.includes("params") ? "params" : path.includes("style") ? "style" : "layout";
  return typeof v === "number"
    ? [{ path, label, kind: "number", value: v, group }]
    : typeof v === "boolean"
      ? [{ path, label, kind: "boolean", value: v, group }]
      : typeof v === "string"
        ? [{ path, label, kind: v.startsWith("cl-") ? "colour" : "text", value: v, group }]
        : Array.isArray(v)
          ? v.flatMap((x, i) => fields(x, [...path, i]))
          : isObject(v)
            ? Object.entries(v).flatMap(([k, x]) => fields(x, [...path, k]))
            : [];
};

// the sections of the settings `s`, in the page's order: the library's components and the layout, the averages, MACD
export const sections = (s: Json): readonly Section[] => {
  const root = isObject(s) ? s : {};
  const chart = isObject(root.chart) ? root.chart : {};
  const averages = Array.isArray(root.averages) ? root.averages : [];
  const period = (a: Json | undefined): string =>
    isObject(a) && isObject(a.params) && typeof a.params.period === "number" ? String(a.params.period) : "";
  return [
    ...Object.entries(chart).map(
      ([k, v]): Section => ({ key: `chart.${k}`, name: names[k] ?? k, fields: fields(v, ["chart", k]) }),
    ),
    ...averages.map(
      (a, i): Section => ({
        key: `averages.${i}`,
        name: `MA${period(a)}`,
        fields: fields(a, ["averages", i]),
      }),
    ),
    ...(root.macd === undefined ? [] : [{ key: "macd", name: "MACD", fields: fields(root.macd, ["macd"]) }]),
  ];
};

// the settings `s` with `value` at `path`, every other value as it was; a path that is not there leaves them as they
// were
export const withValue = (s: Json, path: Path, value: Json): Json => {
  const [head, ...rest] = path;
  return head === undefined
    ? value
    : typeof head === "number"
      ? Array.isArray(s) && head < s.length
        ? s.map((x, i) => (i === head ? withValue(x, rest, value) : x))
        : s
      : isObject(s) && head in s
        ? { ...s, [head]: withValue(s[head] ?? null, rest, value) }
        : s;
};

// the settings `s` with an average more, of `period`, in the first one's style, or with its `i`th taken out
export const withAverage = (s: Json, period: number): Json =>
  isObject(s) && Array.isArray(s.averages)
    ? {
        ...s,
        averages: [
          ...s.averages,
          {
            params: { period },
            style: isObject(s.averages[0]) && isObject(s.averages[0].style) ? s.averages[0].style : {},
          },
        ],
      }
    : s;
export const withoutAverage = (s: Json, i: number): Json =>
  isObject(s) && Array.isArray(s.averages) ? { ...s, averages: s.averages.filter((_, j) => j !== i) } : s;

// the section of a layer of the page, by its name (the legend's): a component of the library, an average by its
// period, MACD; none for another (a page's marks)
export const sectionOf = (name: string, s: Json): string | undefined => {
  const key = Object.entries(names).find(([, n]) => n === name)?.[0];
  const ma = /^MA([0-9]+)$/.exec(name);
  const root = isObject(s) ? s : {};
  const averages = Array.isArray(root.averages) ? root.averages : [];
  const i = ma
    ? averages.findIndex((a) => isObject(a) && isObject(a.params) && a.params.period === Number(ma[1]))
    : -1;
  return key !== undefined && key !== "layout"
    ? `chart.${key}`
    : i >= 0
      ? `averages.${i}`
      : name.startsWith("MACD")
        ? "macd"
        : undefined;
};

// the settings `s` with the section `key` as `defaults` has it: an average beyond the defaults' keeps its period,
// in the first default's style
export const withDefaults = (s: Json, defaults: Json, key: string): Json => {
  const [head, rest] = key.split(".");
  const d = isObject(defaults) ? defaults : {};
  const ds = (k: string): Json | undefined => d[k];
  const chart = ds("chart");
  const averages = ds("averages");
  return head === "chart" && rest !== undefined && isObject(chart) && chart[rest] !== undefined
    ? withValue(s, ["chart", rest], chart[rest] ?? null)
    : head === "averages" && rest !== undefined && Array.isArray(averages)
      ? ((): Json => {
          const i = Number(rest);
          const own = averages[i];
          const first = averages[0];
          const current = isObject(s) && Array.isArray(s.averages) ? s.averages[i] : undefined;
          return own !== undefined
            ? withValue(s, ["averages", i], own)
            : isObject(first) && isObject(current)
              ? withValue(s, ["averages", i], { params: current.params ?? {}, style: first.style ?? {} })
              : s;
        })()
      : head === "macd" && ds("macd") !== undefined
        ? withValue(s, ["macd"], ds("macd") ?? null)
        : s;
};

// each section's 显示, by its key, where it has one: whether its layers are shown at first
export const shows = (s: Json): Readonly<Record<string, boolean>> =>
  Object.fromEntries(
    sections(s).flatMap((x) =>
      x.fields
        .filter((f) => f.path[f.path.length - 1] === "show" && typeof f.value === "boolean")
        .map((f) => [x.key, f.value === true]),
    ),
  );
