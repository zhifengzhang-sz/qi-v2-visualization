// The chart app's settings (settings.ts): chart.toml as shipped gives every default (the picture dark); every value
// written (everyValue, make chart-settings) reads back the same; a colour no lowercase palette name, a key not known, a
// period twice, MACD's fast period not below its slow, or a picture's theme neither dark nor light refused; the colours
// they name found.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pipe, result } from "@qi/base";
import { config } from "@qi/core";
import { describe, expect, it } from "vitest";
import { coloursOf, everyValue, resolved, settingsSchema } from "../src/settings.ts";

const read = (text: string) => pipe(config.fromText(settingsSchema)(text), result.flatMap(resolved));
const shipped = readFileSync(join(import.meta.dirname, "..", "chart.toml"), "utf8");
const every = (text: string) => result.map(everyValue)(read(text));

describe("the settings", () => {
  it("give every default from chart.toml: MA5, MA10, MA30, MACD 12 26 9, the picture 24 by 14 and dark, the library's own", () => {
    const v = every(shipped);
    expect(
      result.map((x: ReturnType<typeof everyValue>) => x.averages.map((a) => a.params.period))(v),
    ).toEqual(result.success([5, 10, 30]));
    expect(result.map((x: ReturnType<typeof everyValue>) => [x.macd.params, x.picture])(v)).toEqual(
      result.success([
        { fast: 12, slow: 26, signal: 9 },
        { width: 24, height: 14, most: 3000, theme: "dark" },
      ]),
    );
    expect(
      result.map((x: ReturnType<typeof everyValue>) => [x.chart.bi.style, x.chart.layout.digits])(v),
    ).toEqual(result.success([{ colour: "cl-stroke", width: 0.7 }, 2]));
  });

  it("read back every value written the same, and take a part of a style over its defaults", () => {
    const written = result.flatMap((x: ReturnType<typeof everyValue>) => config.toText(x))(every(shipped));
    expect(result.flatMap(every)(written)).toEqual(every(shipped));
    const changed = every("[chart.bi.style]\nwidth = 2\n[macd.params]\nfast = 5\n");
    expect(
      result.map((x: ReturnType<typeof everyValue>) => [x.chart.bi.style, x.macd.params])(changed),
    ).toEqual(
      result.success([
        { colour: "cl-stroke", width: 2 },
        { fast: 5, slow: 26, signal: 9 },
      ]),
    );
  });

  it("refuse a colour no palette name, a key not known, a period twice, MACD's fast not below its slow, no room, a theme not known", () => {
    const fails = (text: string) => read(text).tag === "failure";
    expect(fails('[chart.bi.style]\ncolour = "cl-E"\n')).toBe(true);
    expect(fails("[chart.nothing.style]\nx = 1\n")).toBe(true);
    expect(fails("[chart.bi.style]\nx = 1\n")).toBe(true);
    expect(fails("averages = [{ params = { period = 5 } }, { params = { period = 5 } }]\n")).toBe(true);
    expect(fails("[macd.params]\nfast = 26\n")).toBe(true);
    // the margins leaving the main graph no height; a volume band of none
    expect(fails("[chart.layout]\nabove = 0.5\nbelow = 0.5\n")).toBe(true);
    expect(fails("[chart.layout]\nabove = 0.6\n")).toBe(false);
    expect(fails("[chart.volume.style]\nheight = 0\n")).toBe(true);
    // a picture's theme dark or light, nothing else
    expect(fails('[picture]\ntheme = "light"\n')).toBe(false);
    expect(fails('[picture]\ntheme = "grey"\n')).toBe(true);
  });

  it("find every colour they name, each once", () => {
    const cs = result.map(coloursOf)(read('[chart.bi.style]\ncolour = "cl-event"\n'));
    expect(
      result.map((c: readonly string[]) => [
        c.includes("cl-event"),
        c.includes("cl-stroke"),
        new Set(c).size === c.length,
      ])(cs),
    ).toEqual(result.success([true, false, true]));
  });
});
