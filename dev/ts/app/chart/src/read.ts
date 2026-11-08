// The adapter from a run to the components of @qi/chart (docs/designs/design-chart-app-2026-10-24.md, Reading it into
// the contracts): a set of the published results, by the contract's own decodeRun, every rule of its records and of the
// run with it, a fault of the file by its name; its records as they are, the dates already positions and each
// configuration after 包含 already on its merged bars. A run of bars only (in.csv) has its bars as the x-axis and no
// structure. The times of the bars, the marks and the windows are read here too.

import { type Json, pipe, type QiError, type Result, result } from "@qi/base";
import { type Centre, decodeRun, type Fractal, klineSchema, type MergedBar, type Stroke } from "@qi/chanlun";
import type { XAxis } from "@qi/chart";
import { decode } from "@qi/core";
import { z } from "zod";

export type ReadError = QiError<"CHART_READ", "VALIDATION">;

const fault = (message: string, context: { readonly [key: string]: Json } = {}): ReadError => ({
  category: "VALIDATION",
  code: "CHART_READ",
  message,
  context,
});

// A bar of a run of bars only, as the run keeps it (in.csv, input.ts's barsFile): its time, seconds since 1970, UTC;
// its prices, whole numbers at the run's scale; its volume. The app's own record: the library takes market's K-lines,
// which describe.ts makes of these.
const whole = z.number().int();
export const runBarSchema = z
  .object({
    date: z.number().int().nonnegative(),
    open: whole,
    high: whole,
    low: whole,
    close: whole,
    volume: z.number().nonnegative(),
  })
  .strict()
  .readonly()
  .refine(
    (b) => b.low <= Math.min(b.open, b.close) && Math.max(b.open, b.close) <= b.high,
    "a bar's open and close within its low and high",
  );
// a run's K-lines as read: 缠论's (a set of the results) or the run's bars, in time order
export const axisSchema = z
  .array(z.union([klineSchema, runBarSchema]))
  .min(1)
  .readonly()
  .refine(
    (ks) => ks.every((k, i) => i === 0 || (ks[i - 1]?.date ?? k.date) < k.date),
    "the K-lines strictly in time",
  );

// a run's structure, as read
export type Structure = {
  readonly xs: XAxis;
  readonly ms: readonly MergedBar[];
  readonly fs: readonly Fractal[];
  readonly bs: readonly Stroke[];
  readonly ds: readonly Stroke[];
  readonly zs: readonly Stroke[];
  readonly zh: readonly Centre[];
};

// A file's rows by its header's names; its fields hold no comma (the bars' CSV, history.csv).
export const rows =
  (name: string) =>
  (text: string): Result<readonly { readonly [key: string]: string }[], ReadError> => {
    const [head, ...rest] = text.split("\n").filter((line) => line !== "");
    return head === undefined
      ? result.failure(fault(`${name}: no header`, { file: name }))
      : result.success(
          rest.map((line) => {
            const fields = line.split(",");
            return Object.fromEntries(head.split(",").map((n, i) => [n, fields[i] ?? ""]));
          }),
        );
  };

// Days from 1970-01-01 to a day of the Gregorian calendar (H. Hinnant's days_from_civil).
export const days = (y: number, m: number, d: number): number => {
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * ((m + 9) % 12) + 2) / 5) + d - 1;
  return era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468;
};

// a date `YYYY-MM-DD HH:MM:SS` that is a day of the calendar and a time of a day (no 2025-02-30, no 24:00), so none
// is read as another
export const calendar = (s: string): boolean => {
  const [y = 0, mo = 0, d = 0, h = 0, mi = 0, se = 0] = s.split(/[- :]/).map(Number);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const length = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1] ?? 0;
  return d >= 1 && d <= length && h < 24 && mi < 60 && se < 60;
};

// days since 1970-01-01 as a calendar date, the inverse of `days` (H. Hinnant's civil_from_days)
export const civil = (n: number): readonly [number, number, number] => {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365,
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d];
};

// a date as seconds since 1970, read as UTC
export const epoch = (s: string): number => {
  const [y = 0, mo = 0, d = 0, h = 0, mi = 0, se = 0] = s.split(/[- :]/).map(Number);
  return days(y, mo, d) * 86400 + h * 3600 + mi * 60 + se;
};

const int = z
  .string()
  .regex(/^-?[0-9]+$/)
  .transform(Number);

const decoded =
  <S extends z.ZodType>(schema: S, name: string) =>
  (text: string): Result<readonly z.output<S>[], ReadError> =>
    pipe(
      rows(name)(text),
      result.flatMap((rs) =>
        pipe(
          rs,
          result.traverse(decode(schema)),
          result.mapError((e) => fault(`${name}: ${e.message}`, { file: name })),
        ),
      ),
    );

// history.csv (a producer of daily and monthly runs writes it): the closes before the run's first K-line, `d,c`, at the
// run's scale; none where the run has none (its text empty)
const historyRow = z.object({ d: z.string(), c: int }).loose();
export const history = (text: string): Result<readonly number[], ReadError> =>
  text === ""
    ? result.success([])
    : pipe(
        decoded(historyRow, "history.csv")(text),
        result.map((rs) => rs.map((r) => r.c)),
      );

// in.csv of a run of bars only (input.ts, barsFile: date,open,high,low,close,volume, the date in seconds) as the
// x-axis of its bars
export const barsAxis = (text: string): Result<XAxis, ReadError> =>
  pipe(
    text
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map((l) => l.split(",").map(Number)),
    (rows) =>
      rows.map(
        ([
          date = Number.NaN,
          open = Number.NaN,
          high = Number.NaN,
          low = Number.NaN,
          close = Number.NaN,
          volume = 0,
        ]) => ({
          date,
          open,
          high,
          low,
          close,
          volume,
        }),
      ),
    (v) =>
      pipe(
        decode(axisSchema)(v),
        result.mapError((e) => fault(`in.csv: ${e.message}`, { file: "in.csv" })),
      ),
  );

// in.csv of a run of bars only as its structure: its bars the x-axis, nothing of 缠论
export const barsOf = (text: string): Result<Structure, ReadError> =>
  pipe(
    barsAxis(text),
    result.map((xs) => ({ xs, ms: [], fs: [], bs: [], ds: [], zs: [], zh: [] })),
  );

// A run's file as its structure, by the contract's own decodeRun: 线段 its segments, 走势 and 中枢 each level's after the
// one before, each record keeping its level.
export const runOf =
  (file: string) =>
  (text: string): Result<Structure, ReadError> => {
    const got = decodeRun(text);
    return got.ok
      ? result.success({
          xs: got.run.klines,
          ms: got.run.merged,
          fs: got.run.fractals,
          bs: got.run.strokes,
          ds: got.run.segments,
          zs: got.run.trends.flat(),
          zh: got.run.centres.flat(),
        })
      : result.failure(fault(`${file}: ${got.error}`, { file }));
  };
