// The settings dialog's pure part (dialog.ts): a section for each component, the averages and MACD, a field for each
// value by its kind; a value set at its path, the rest as it was; an average added and taken out.

import type { Json } from "@qi/base";
import { describe, expect, it } from "vitest";
import {
  sectionOf,
  sections,
  shows,
  withAverage,
  withDefaults,
  withoutAverage,
  withValue,
} from "../src/dialog.ts";

const settings: Json = {
  chart: {
    candles: { style: { up: "cl-up", down: "cl-down" } },
    profile: { params: { rows: 24 }, style: { opacity: 0.4 } },
    layout: { digits: 2, levels: ["cl-center", "cl-event"] },
  },
  averages: [
    { params: { period: 5 }, style: { colour: "cl-ink", width: 1 } },
    { params: { period: 10 }, style: { colour: "cl-center", width: 1 } },
  ],
  macd: { params: { fast: 12, slow: 26, signal: 9 }, style: { diff: "cl-ink" } },
  picture: { width: 24, theme: "dark" },
};

describe("the settings dialog", () => {
  it("gives a section for each component, each average and MACD, none for the picture", () => {
    expect(sections(settings).map((s) => [s.key, s.name])).toEqual([
      ["chart.candles", "K线"],
      ["chart.profile", "成交量分布"],
      ["chart.layout", "布局"],
      ["averages.0", "MA5"],
      ["averages.1", "MA10"],
      ["macd", "MACD"],
    ]);
  });

  it("gives a field for each value, by its kind, labelled by its key's name in the page", () => {
    const [, profile, layout, , , macd] = sections(settings);
    expect(profile?.fields).toEqual([
      {
        path: ["chart", "profile", "params", "rows"],
        label: "行数",
        kind: "number",
        value: 24,
        group: "params",
      },
      {
        path: ["chart", "profile", "style", "opacity"],
        label: "不透明度",
        kind: "number",
        value: 0.4,
        group: "style",
      },
    ]);
    expect(layout?.fields.map((f) => [f.label, f.kind])).toEqual([
      ["小数位", "number"],
      ["级别颜色 0", "colour"],
      ["级别颜色 1", "colour"],
    ]);
    expect(macd?.fields.map((f) => f.label)).toEqual(["快线", "慢线", "信号线", "DIFF"]);
  });

  it("sets a value at its path, every other as it was; a path not there changes nothing", () => {
    const s = withValue(settings, ["macd", "params", "fast"], 8);
    expect(sections(s)[5]?.fields[0]?.value).toBe(8);
    expect(withValue(s, ["macd", "params", "fast"], 12)).toEqual(settings);
    expect(withValue(settings, ["averages", 1, "params", "period"], 20)).toMatchObject({
      averages: [{ params: { period: 5 } }, { params: { period: 20 } }],
    });
    expect(withValue(settings, ["averages", 5, "params", "period"], 20)).toEqual(settings);
    expect(withValue(settings, ["chart", "nothing"], 1)).toEqual(settings);
  });

  it("adds an average in the first one's style, and takes one out", () => {
    const more = withAverage(settings, 60);
    expect(sections(more).map((s) => s.name)).toContain("MA60");
    expect(more).toMatchObject({
      averages: [{}, {}, { params: { period: 60 }, style: { colour: "cl-ink" } }],
    });
    expect(sections(withoutAverage(settings, 0)).map((s) => s.name)).toEqual([
      "K线",
      "成交量分布",
      "布局",
      "MA10",
      "MACD",
    ]);
  });
});

describe("the settings dialog's sections, by the legend and by their defaults", () => {
  it("finds a layer's section by its name", () => {
    expect(sectionOf("K线", settings)).toBe("chart.candles");
    expect(sectionOf("成交量分布", settings)).toBe("chart.profile");
    expect(sectionOf("MA10", settings)).toBe("averages.1");
    expect(sectionOf("MA60", settings)).toBeUndefined();
    expect(sectionOf("MACD 12 26 9", settings)).toBe("macd");
    expect(sectionOf("布局", settings)).toBeUndefined();
    expect(sectionOf("4129（1/2线）", settings)).toBeUndefined();
  });

  it("groups each field as a parameter, a style or the layout's", () => {
    const [, profile, layout] = sections(settings);
    expect(profile?.fields.map((f) => f.group)).toEqual(["params", "style"]);
    expect(layout?.fields.every((f) => f.group === "layout")).toBe(true);
  });

  it("puts a section back to its defaults, the rest as it was", () => {
    const changed = withValue(
      withValue(settings, ["macd", "params", "fast"], 4),
      ["averages", 1, "style", "width"],
      3,
    );
    expect(withDefaults(changed, settings, "macd")).toEqual(
      withValue(settings, ["averages", 1, "style", "width"], 3),
    );
    expect(withDefaults(changed, settings, "averages.1")).toEqual(
      withValue(settings, ["macd", "params", "fast"], 4),
    );
    const more = withAverage(withValue(settings, ["averages", 0, "style", "width"], 2), 60);
    expect(withDefaults(more, settings, "averages.2")).toMatchObject({
      averages: [{}, {}, { params: { period: 60 }, style: { colour: "cl-ink", width: 1 } }],
    });
  });
});

describe("the settings dialog's 显示", () => {
  it("gives each section's 显示 where it has one", () => {
    const s = withValue(
      {
        chart: { merged: { show: true, style: { showBox: true } }, layout: { digits: 2 } },
        macd: { show: false },
      },
      ["chart", "merged", "show"],
      false,
    );
    expect(shows(s)).toEqual({ "chart.merged": false, macd: false });
    expect(sections(s)[0]?.fields.map((f) => [f.label, f.group])).toEqual([
      ["显示", "layout"],
      ["显示方框", "style"],
    ]);
  });
});
