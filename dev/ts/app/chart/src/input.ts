// A chart of bars alone (docs/designs/design-chart-app-2026-10-24.md, Making a run; written by any producer of bars): a CSV of
// bars, `time,open,high,low,close` and optionally `volume`, one bar a line in time order; the time `YYYY-MM-DD HH:MM`,
// `YYYY-MM-DD HH:MM:SS` or `YYYY-MM-DD` (a day), on any clock (it is read as UTC and shown as it is); the prices
// decimals, held as whole numbers at a scale, a power of ten: exactly, a price with more decimals than the scale holds
// refused, never rounded. From it, what a run of bars only keeps of them (in.csv).

import { type Json, pipe, type QiError, type Result, result } from "@qi/base";
import { decode } from "@qi/core";
import { z } from "zod";
import { calendar, epoch, rows } from "./read.ts";

export type InputError = QiError<"CHART_INPUT", "VALIDATION">;

const fault = (message: string, context: { readonly [key: string]: Json } = {}): InputError => ({
  category: "VALIDATION",
  code: "CHART_INPUT",
  message,
  context,
});

// the scales a price may have: 1, 10, 100, … 1,000,000
export const scales = [1, 10, 100, 1000, 10000, 100000, 1000000] as const;

// A decimal as a whole number at the scale, exactly: "567.78" at 100 is 56778; "567.785" at 100 is refused.
export const atScale =
  (scale: number) =>
  (s: string): Result<number, InputError> => {
    const m = /^(-?)([0-9]+)(?:\.([0-9]+))?$/.exec(s.trim());
    const places = Math.round(Math.log10(scale));
    const whole = m?.[2];
    const frac = (m?.[3] ?? "").replace(/0+$/, "");
    return m === null || whole === undefined
      ? result.failure(fault(`not a price: ${s}`, { price: s }))
      : frac.length > places
        ? result.failure(fault(`${s} has more decimals than the scale ${scale} holds`, { price: s, scale }))
        : result.success(
            (m[1] === "-" ? -1 : 1) * (Number(whole) * scale + Number(frac.padEnd(places, "0") || "0")),
          );
  };

const full = (s: string): string => (s.length === 10 ? `${s} 00:00:00` : s.length === 16 ? `${s}:00` : s);

const time = z
  .string()
  .trim()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}( [0-9]{2}:[0-9]{2}(:[0-9]{2})?)?$/)
  .refine((s) => calendar(full(s)), "a day of the calendar and a time of a day");
// a volume, where the bars have one: a whole number or a decimal, not below 0
const volume = z
  .string()
  .trim()
  .regex(/^[0-9]+(\.[0-9]+)?$/, "a volume is a number not below 0")
  .transform(Number);
const row = z
  .object({
    time,
    open: z.string(),
    high: z.string(),
    low: z.string(),
    close: z.string(),
    volume: volume.optional(),
  })
  .loose();

export type Bar = {
  readonly d: string; // YYYY-MM-DD HH:MM:SS
  readonly t: number; // seconds, the time read as UTC
  readonly label: number; // yyyymmddhhmm, or yyyymmdd for a chart of days
  readonly o: number;
  readonly h: number;
  readonly l: number;
  readonly c: number;
  readonly v: number;
};

// The bars of an input CSV at a scale: every row through its schema, every price exact, each bar's low not above
// its open, close or high, the times strictly in order.
export const parse =
  (scale: number) =>
  (text: string): Result<readonly Bar[], InputError> =>
    pipe(
      rows("input")(text),
      result.mapError((e) => fault(e.message)),
      result.flatMap((rs) =>
        result.traverse((r: { readonly [key: string]: string }) =>
          pipe(
            decode(row)(r),
            result.mapError((e) => fault(`input: ${e.message}`, { row: r.time ?? "" })),
            result.flatMap((x) =>
              pipe(
                result.traverse(atScale(scale))([x.open, x.high, x.low, x.close]),
                result.map(([o = 0, h = 0, l = 0, c = 0]): Bar => {
                  const d = full(x.time);
                  const digits = d.replace(/[^0-9]/g, "");
                  return {
                    d,
                    t: epoch(d),
                    label: x.time.length === 10 ? Number(digits.slice(0, 8)) : Number(digits.slice(0, 12)),
                    o,
                    h,
                    l,
                    c,
                    v: x.volume ?? 0,
                  };
                }),
              ),
            ),
          ),
        )(rs),
      ),
      result.flatMap((bs) => {
        const bad = bs.findIndex((b) => b.l > Math.min(b.o, b.c) || b.h < Math.max(b.o, b.c) || b.l > b.h);
        const unordered = bs.findIndex((b, i) => i > 0 && (bs[i - 1]?.t ?? b.t) >= b.t);
        return bs.length === 0
          ? result.failure(fault("input: no bars"))
          : bad !== -1
            ? result.failure(
                fault(`input: bar ${bad} has its low above its open, close or high, or its high below`),
              )
            : unordered !== -1
              ? result.failure(
                  fault(`input: bar ${unordered} is not after the one before`, { bar: unordered }),
                )
              : result.success(bs);
      }),
    );

// What a run of bars only keeps of them, in.csv: one bar a line, date,open,high,low,close,volume, the date in seconds.
export const barsFile = (bs: readonly Bar[]): string =>
  bs.map((b) => `${b.t},${b.o},${b.h},${b.l},${b.c},${Math.round(b.v)}\n`).join("");
