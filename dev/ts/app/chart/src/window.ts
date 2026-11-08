// A page's window (the K-lines it shows): what of a run a page is given, where the run is longer than the page should
// carry. The 缠论 structure is always the whole series' (the run computes it over every bar); the window only chooses
// what the page gets, so a configuration looks in the window exactly as it does in the whole series:
// - the window's K-lines;
// - the configurations wholly inside it, their positions moved to the window's first K-line, their confirmations as
//   the whole series has them (a confirmation after the window's last K-line is kept, beyond it);
// - the closes before the window, after the run's own history, so that the indicators start from the whole series.
// A configuration that crosses an edge of the window is not given.

import { type QiError, type Result, result } from "@qi/base";
import type { Stroke } from "@qi/chanlun";
import { calendar, civil, days, epoch, type Structure } from "./read.ts";

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

// The page's part of a run's structure, K-lines a to b, and the closes before them.
export const windowed =
  (a: number, b: number) =>
  (
    s: Structure,
    history: readonly number[],
  ): { readonly structure: Structure; readonly history: readonly number[] } => {
    const at = (p: number): number => p - a;
    // an optional position, moved where it is there
    const opt = <K extends string>(k: K, p: number | undefined): { readonly [P in K]?: number } =>
      p === undefined ? {} : ({ [k]: at(p) } as { readonly [P in K]: number });
    const inside = (from: number, to: number): boolean => from >= a && to <= b;
    const ms = s.ms.filter((m) => inside(m.startDate, m.endDate));
    const kept = new Set(ms.map((m) => m.mno));
    const line = (l: Stroke): Stroke => ({
      ...l,
      startDate: at(l.startDate),
      endDate: at(l.endDate),
      ...opt("confirmStartDate", l.confirmStartDate),
      ...opt("confirmEndDate", l.confirmEndDate),
    });
    const lines = (ls: readonly Stroke[]) =>
      ls.filter((l) => kept.has(l.startBar) && kept.has(l.endBar)).map(line);
    return {
      structure: {
        xs: s.xs
          .slice(a, b + 1)
          .map((k) =>
            "confirmDate" in k && k.confirmDate !== undefined ? { ...k, confirmDate: at(k.confirmDate) } : k,
          ),
        ms: ms.map((m) => ({
          ...m,
          startDate: at(m.startDate),
          endDate: at(m.endDate),
          ...opt("confirmStartDate", m.confirmStartDate),
          ...opt("confirmEndDate", m.confirmEndDate),
        })),
        fs: s.fs
          .filter((f) => kept.has(f.mno))
          .map((f) => ({
            ...f,
            date: at(f.date),
            ...opt("confirmStartDate", f.confirmStartDate),
            ...opt("confirmEndDate", f.confirmEndDate),
            ...opt("confirmTurningPointDate", f.confirmTurningPointDate),
          })),
        bs: lines(s.bs),
        ds: lines(s.ds),
        zs: lines(s.zs),
        zh: s.zh
          .filter((z) => [z.startBar, z.endBar, z.ggBar, z.ddBar].every((m) => kept.has(m)))
          .map((z) => ({
            ...z,
            startDate: at(z.startDate),
            endDate: at(z.endDate),
            ggDate: at(z.ggDate),
            ddDate: at(z.ddDate),
            ...opt("confirmStartDate", z.confirmStartDate),
            ...opt("confirmEndDate", z.confirmEndDate),
          })),
      },
      history: [...history, ...s.xs.slice(0, a).map((k) => k.close)],
    };
  };
