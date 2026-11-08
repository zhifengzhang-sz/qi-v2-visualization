// 周期 (periods.ts): the same bars' runs at each period, given as NAME=DIR,…, each page's pull-down.

import { result } from "@qi/base";
import { describe, expect, it } from "vitest";
import { periods } from "../src/index.ts";

const ok = <T>(r: ReturnType<ReturnType<typeof periods>>): T | undefined =>
  result.match(
    (v) => v as T,
    () => undefined,
  )(r);
const fault = (r: ReturnType<ReturnType<typeof periods>>): string | undefined =>
  result.match(
    () => undefined,
    (e: string) => e,
  )(r);

describe("periods", () => {
  it("is none when none are given", () => {
    expect(ok(periods(undefined, "/r/SPY-5m")("chart.html"))).toEqual({ current: "", pages: [] });
  });

  it("gives each period's page of the same engine, relative to this folder", () => {
    expect(ok(periods("1m=/r/SPY-1m,5m=/r/SPY-5m/,1d=/r/x/SPY-1d", "/r/SPY-5m")("chart-d3fc.html"))).toEqual({
      current: "5m",
      pages: [
        { name: "1m", href: "../SPY-1m/chart-d3fc.html" },
        { name: "5m", href: "chart-d3fc.html" },
        { name: "1d", href: "../x/SPY-1d/chart-d3fc.html" },
      ],
    });
  });

  it("refuses a pair that is not NAME=DIR, a name twice, and a list without this folder", () => {
    expect(fault(periods("1m=/r/a,5m", "/r/a")("p.html"))).toBe("--periods: 5m is not NAME=DIR");
    expect(fault(periods("1m=/r/a,1m=/r/b", "/r/a")("p.html"))).toBe("--periods: a name given twice");
    expect(fault(periods("1m=/r/a", "/r/b")("p.html"))).toBe(
      "--periods: this folder, /r/b, is not among them",
    );
  });
});
