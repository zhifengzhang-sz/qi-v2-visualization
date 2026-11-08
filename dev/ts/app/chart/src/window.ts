// A page's window (the K-lines it shows): what of a run of bars alone a page is given, where the run is longer than
// the page should carry: the window's K-lines, and the closes before the window, after the run's own history, so that
// the indicators start from the whole series. A run with 缠论's records beside its bars has no window
// (docs/designs/design-chart-chanlun-3-2026-11-09.md, The chart app): its merged bars are numbered by their place, so
// a window would number every record again and cut the confirmations past its end.

import { type QiError, type Result, result } from "@qi/base";
import type { XAxis } from "@qi/chart";
import { calendar, civil, days, epoch } from "./read.ts";

export type WindowError = QiError<"CHART_WINDOW", "VALIDATION">;

const fault = (message: string): WindowError => ({
  category: "VALIDATION",
  code: "CHART_WINDOW",
  message,
  context: {},
});

// a window as asked: FROM:TO, two days of the calendar (YYYY-MM-DD, both included, no 2025-02-29); or the last N years
// or months (Ny, Nm)
export type Window =
  | { readonly from: string; readonly to: string }
  | { readonly last: number; readonly unit: "y" | "m" };

export const windowOf = (s: string): Result<Window, WindowError> => {
  const dates = /^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(s);
  const last = /^(\d+)([ym])$/.exec(s);
  return dates?.[1] !== undefined &&
    dates[2] !== undefined &&
    calendar(`${dates[1]} 00:00:00`) &&
    calendar(`${dates[2]} 00:00:00`)
    ? result.success({ from: dates[1], to: dates[2] })
    : last?.[1] !== undefined && (last[2] === "y" || last[2] === "m") && Number(last[1]) > 0
      ? result.success({ last: Number(last[1]), unit: last[2] })
      : result.failure(
          fault(
            `${s}: a window is FROM:TO (YYYY-MM-DD:YYYY-MM-DD, days of the calendar) or the last N years or months (Ny, Nm)`,
          ),
        );
};

// a day's first second, read as UTC as the K-lines' times are
const dayStart = (d: string): number => epoch(`${d} 00:00:00`);

// the time N years or months before t, the day of the month kept where the month has it, else its last day
const before = (t: number, n: number, unit: "y" | "m"): number => {
  const [y, m, d] = civil(Math.floor(t / 86400));
  const months = y * 12 + (m - 1) - (unit === "y" ? 12 * n : n);
  const [yy, mm] = [Math.floor(months / 12), (months % 12) + 1];
  const last = civil(days(mm === 12 ? yy + 1 : yy, mm === 12 ? 1 : mm + 1, 1) - 1)[2];
  return days(yy, mm, Math.min(d, last)) * 86400 + (t % 86400);
};

// The positions of the window's first and last K-lines, by the K-lines' times.
export const span = (times: readonly number[], w: Window): Result<readonly [number, number], WindowError> => {
  const lastTime = times.at(-1) ?? 0;
  const [t0, t1] =
    "from" in w
      ? [dayStart(w.from), dayStart(w.to) + 86400 - 1]
      : [before(lastTime, w.last, w.unit), lastTime];
  const a = times.findIndex((t) => t >= t0);
  const b = times.findLastIndex((t) => t <= t1);
  return a < 0 || b < a
    ? result.failure(fault("the window holds none of the run's K-lines"))
    : result.success([a, b] as const);
};

// The page's part of a run's bars, K-lines a to b, and the closes before them.
export const windowed =
  (a: number, b: number) =>
  (xs: XAxis, history: readonly number[]): { readonly xs: XAxis; readonly history: readonly number[] } => ({
    xs: xs.slice(a, b + 1),
    history: [...history, ...xs.slice(0, a).map((k) => k.close)],
  });
