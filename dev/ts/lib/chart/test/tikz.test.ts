// The TikZ engine (tikz.ts): a standalone document for XeLaTeX, the palette's light or dark colours defined; the K-lines of
// the range drawn, a wick and a body each, and none outside it; the main graph clipped; a subgraph for an add-on in
// one; the prices right of the graph, the dates under it; round ticks; the caller's marks.

import { result } from "@qi/base";
import { type KLine, klinesSchema } from "@qi/chanlun";
import { decode } from "@qi/core";
import { describe, expect, it } from "vitest";
import { type AddOn, addOn, type MarkLayer, tikzChart } from "../src/index.ts";
import { markLayerSchema } from "../src/marking.ts";
import { cut, ticks } from "../src/tikz.ts";

// ten daily K-lines from 2007-05-21, rising by 1.00 a day, at a scale of 100
const xs: readonly KLine[] = result.getOrElse((): readonly KLine[] => [])(
  decode(klinesSchema)(
    Array.from({ length: 10 }, (_, i) => ({
      rno: i,
      date: 1179705600 + 86400 * i,
      up: true,
      open: 1000 + 100 * i,
      high: 1050 + 100 * i,
      low: 990 + 100 * i,
      close: 1040 + 100 * i,
      volume: 10,
      confirmRno: 0,
      stored: 1,
    })),
  ),
);

const sub: AddOn = addOn({
  key: "s",
  name: "s",
  place: "sub",
  on: true,
  params: {},
  style: {},
  derive: (ks) => ks.map((k) => k.close),
  draw: (e) => (values, pane) => [
    e.series(
      values.map((value, at) => ({ at, value })),
      "line",
      { pane },
      { colour: "cl-ink", dashed: false },
    ),
  ],
});

const picture = (
  from: number,
  to: number,
  addons: readonly AddOn[] = [],
  theme: "light" | "dark" = "light",
  marked: readonly MarkLayer[] = [],
) =>
  result.getOrElse(() => "")(
    tikzChart(
      {
        title: "SH000001_1D",
        scale: 100,
        xAxis: xs,
        merged: [],
        fractals: [],
        strokes: [],
        duan: [],
        zoushi: [],
        zhongshu: [],
        addons,
      },
      {
        from,
        to,
        width: 10,
        height: 6,
        palette: { "cl-up": ["#D62728", "#F2665E"], "cl-ink": ["#1A1A1A", "#D7DAE0"] },
        theme,
      },
      "all",
      marked,
    ),
  );

const layer = (v: unknown): MarkLayer =>
  result.getOrElse((): MarkLayer => ({ key: "none", name: "none", on: false, marks: [] }))(
    decode(markLayerSchema)(v),
  );

describe("the TikZ engine", () => {
  it("writes a standalone document for XeLaTeX, the palette's light colours, the title escaped", () => {
    const t = picture(0, 9);
    expect(t).toContain("\\definecolor{cl-ink}{HTML}{1A1A1A}");
    expect(t.startsWith("\\documentclass[tikz,border=4pt]{standalone}\n\\usepackage{xeCJK}\n")).toBe(true);
    expect(t).toContain("\\definecolor{cl-up}{HTML}{D62728}");
    expect(t).toContain("SH000001\\_1D");
    expect(t.trimEnd().endsWith("\\end{document}")).toBe(true);
  });

  it("takes the dark colours for the dark theme, on a page of cl-bg, its text cl-ink, under the style cl chart", () => {
    const t = picture(0, 9, [], "dark");
    expect(t).toContain("\\definecolor{cl-up}{HTML}{F2665E}");
    expect(t).not.toContain("D62728");
    expect(t).toContain("\\tikzset{cl chart/.style={every node/.append style={text=cl-ink}}}");
    expect(t).toContain("\\pagecolor{cl-bg}\n\\begin{document}\n");
    expect(t).toContain("\\begin{tikzpicture}[cl chart, x=1cm, y=1cm, font=\\scriptsize]");
  });

  it("draws the K-lines of the range only, each a wick and a body, in a clipped main graph", () => {
    const wicks = (t: string) => (t.match(/\\draw\[cl-up, line width=0\.75pt\]/g) ?? []).length;
    expect(wicks(picture(0, 9))).toBe(10);
    expect(wicks(picture(2, 5))).toBe(4);
    expect(picture(0, 9)).toContain("\\clip (0,0) rectangle (10,6);");
  });

  it("gives an add-on in a subgraph its own band under the main graph, and the dates under the last pane", () => {
    const t = picture(0, 9, [sub]);
    // the main graph four fifths of the height, the subgraph the fifth under it
    expect(t).toContain("\\clip (0,1.2) rectangle (10,6);");
    expect(t).toContain("\\clip (0,0) rectangle (10,1.2);");
    // six dates spread over the range, the first a little in: the second K-line's
    expect(t).toContain("{2007-05-22}");
  });

  it("finds round ticks", () => {
    expect(ticks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(ticks(4087.3, 4131.2, 4)).toEqual([4100, 4120]);
    expect(ticks(1, 1, 4)).toEqual([]);
  });

  it("cuts a line to the picture, and leaves out one that misses it", () => {
    expect(cut([-10, 1], [10, 1], [0, 5, 0, 5])).toEqual([
      [0, 1],
      [5, 1],
    ]);
    expect(cut([1, 1], [2, 2], [0, 5, 0, 5])).toEqual([
      [1, 1],
      [2, 2],
    ]);
    expect(cut([-3, -3], [-1, -1], [0, 5, 0, 5])).toBeUndefined();
  });

  it("draws the marks of the layers ticked at first, in the range: boxes under the candles, the rest over them", () => {
    const on = layer({
      key: "on",
      name: "on",
      marks: [
        { kind: "box", from: 2, to: 3, low: 11, high: 12, colour: "cl-up" },
        {
          kind: "line",
          from: { at: 0, price: 11 },
          to: { at: 9, price: 11 },
          colour: "cl-ink",
          dashed: true,
        },
        { kind: "dot", at: { at: 4, price: 13 }, colour: "cl-ink" },
        { kind: "text", at: { at: 4, price: 13 }, text: "4129_点", anchor: "above", colour: "cl-ink" },
      ],
    });
    const off = layer({
      key: "off",
      name: "off",
      on: false,
      marks: [
        { kind: "text", at: { at: 1, price: 11 }, text: "not drawn", anchor: "below", colour: "cl-ink" },
      ],
    });
    const t = picture(0, 9, [], "light", [on, off]);
    const box = t.indexOf("\\fill[cl-up, opacity=0.25] (2,");
    expect(box).toBeGreaterThan(-1);
    expect(box).toBeLessThan(t.indexOf("\\draw[cl-up, line width=0.75pt]"));
    expect(t).toContain(
      "\\draw[cl-ink, line width=0.75pt, dash pattern=on 4.5pt off 3pt, line cap=round] (0.5,",
    );
    expect(t).toContain("circle (2.25pt);");
    expect(t).toContain(
      "\\node[anchor=south, yshift=4.5pt, text=cl-ink, inner sep=0pt, font=\\fontsize{9pt}{10.8pt}\\selectfont] at (4.5,",
    );
    expect(t).toContain("{4129\\_点}");
    expect(t).not.toContain("not drawn");
    expect(t.indexOf("{4129\\_点}")).toBeGreaterThan(t.lastIndexOf("\\draw[cl-up, line width=0.75pt]"));
  });

  it("refuses a mark past the chart's K-lines", () => {
    const past = layer({
      key: "past",
      name: "past",
      marks: [{ kind: "dot", at: { at: 20, price: 13 }, colour: "cl-up" }],
    });
    const t = tikzChart(
      {
        title: "t",
        scale: 100,
        xAxis: xs,
        merged: [],
        fractals: [],
        strokes: [],
        duan: [],
        zoushi: [],
        zhongshu: [],
        addons: [],
      },
      { from: 0, to: 9, width: 10, height: 6, palette: {}, theme: "light" },
      "all",
      [past],
    );
    expect(t.tag === "failure" && t.error.message).toBe("a mark at K-line 20, past the chart's 10");
  });

  it("refuses digits a price cannot be written to", () => {
    const c = {
      title: "t",
      scale: 100,
      options: { layout: { digits: -1 } },
      xAxis: xs,
      merged: [],
      fractals: [],
      strokes: [],
      duan: [],
      zoushi: [],
      zhongshu: [],
      addons: [],
    };
    const o = { from: 0, to: 9, width: 10, height: 6, palette: {}, theme: "light" as const };
    expect(tikzChart(c, o).tag).toBe("failure");
    expect(tikzChart({ ...c, options: { layout: { digits: 4 } } }, o).tag).toBe("success");
  });
});
