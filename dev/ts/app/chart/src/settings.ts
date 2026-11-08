// The chart app's settings (README.md, The settings; docs/designs/design-chart-lib-2026-10-24.md, Version 1.7): how a
// run is shown, not what it is, read from a TOML file (chart.toml, or another given by --config) through @qi/core's
// config. Every value has its default, here for the app's own and in @qi/chart for the library's; a file gives only
// what differs. `chart`: the library's options, for its components (K线, 成交量, 包含, 分型, 笔, 线段, 走势, 中枢,
// 成交量分布) by their keys, each a part of its style (and parameters), and the layout. `averages`: the moving
// averages on the main graph, each its parameter, its period, and its style. `macd`: MACD's parameters and style.
// `picture`: the static picture's size in centimetres, the most K-lines it draws, and its theme, dark or light.
// `resolved` puts them over the defaults and checks what one field alone cannot (each average's period once, MACD's
// fast below its slow).

import { pipe, type QiError, type Result, result } from "@qi/base";
import { colourSchema, effective, merged, type Options, optionsSchema, widthSchema } from "@qi/chart";
import { type Period, period } from "@qi/indicator";
import { z } from "zod";

const periodNumber = z.number().int().min(1).max(1000);

export const maStyleSchema = z.object({ colour: colourSchema, width: widthSchema }).strict();
export type MaStyle = z.output<typeof maStyleSchema>;
export const macdStyleSchema = z
  .object({
    diff: colourSchema,
    dea: colourSchema,
    up: colourSchema,
    down: colourSchema,
    width: widthSchema,
    // its DIFF, its DEA and its bars, each shown or not
    showDiff: z.boolean(),
    showDea: z.boolean(),
    showBars: z.boolean(),
  })
  .strict();
export type MacdStyle = z.output<typeof macdStyleSchema>;
const macdParamsSchema = z.object({ fast: periodNumber, slow: periodNumber, signal: periodNumber }).strict();
const pictureSchema = z
  .object({
    width: z.number().positive().max(100),
    height: z.number().positive().max(100),
    most: z.number().int().min(1).max(10000),
    theme: z.enum(["dark", "light"]),
  })
  .strict();
export type Picture = z.output<typeof pictureSchema>;

export const settingsSchema = z
  .object({
    chart: optionsSchema,
    averages: z
      .array(
        z
          .object({
            // shown at first
            show: z.boolean().optional(),
            params: z.object({ period: periodNumber }).strict(),
            style: maStyleSchema.partial().strict().optional(),
          })
          .strict(),
      )
      .max(8),
    macd: z
      .object({
        show: z.boolean().optional(),
        params: macdParamsSchema.partial().strict().optional(),
        style: macdStyleSchema.partial().strict().optional(),
      })
      .strict(),
    picture: pictureSchema.partial().strict(),
  })
  .partial()
  .strict();
export type Settings = z.output<typeof settingsSchema>;

// the defaults of the app's own: MA5, MA10, MA30 in ink, the centre's and the gap's colours; MACD 12 26 9, DIFF in
// ink, DEA in the centre's colour, the bars in the candles'; the picture 24 by 14 cm, 3,000 K-lines at most, dark
const lineWidth = 1;
const averagesDefaults = [
  { period: 5, colour: "cl-ink" },
  { period: 10, colour: "cl-center" },
  { period: 30, colour: "cl-gap" },
].map((a) => ({ show: true, params: { period: a.period }, style: { colour: a.colour, width: lineWidth } }));
const macdDefaults = {
  params: { fast: 12, slow: 26, signal: 9 },
  style: {
    diff: "cl-ink",
    dea: "cl-center",
    up: "cl-up",
    down: "cl-down",
    width: lineWidth,
    showDiff: true,
    showDea: true,
    showBars: true,
  },
};
const pictureDefaults: Picture = { width: 24, height: 14, most: 3000, theme: "dark" };

// The settings over the defaults, every value there, the periods as @qi/indicator's.
export type Resolved = {
  readonly chart: Options;
  readonly averages: readonly {
    readonly show: boolean;
    readonly params: { readonly period: Period };
    readonly style: MaStyle;
  }[];
  readonly macd: {
    readonly show: boolean;
    readonly params: { readonly fast: Period; readonly slow: Period; readonly signal: Period };
    readonly style: MacdStyle;
  };
  readonly picture: Picture;
};
export type SettingsError = QiError<"CHART_SETTINGS", "CONFIGURATION">;
const fault = (message: string): SettingsError => ({
  category: "CONFIGURATION",
  code: "CHART_SETTINGS",
  message,
  context: {},
});
const periodOf = (n: number): Result<Period, SettingsError> =>
  result.mapError(() => fault(`a period, ${n}: a whole number from 1`))(period(n));

export const resolved = (s: Settings): Result<Resolved, SettingsError> => {
  const averages =
    s.averages?.map((a) => ({
      show: a.show ?? true,
      params: a.params,
      style: merged({ colour: "cl-ink", width: lineWidth }, a.style),
    })) ?? averagesDefaults;
  const macd = {
    show: s.macd?.show ?? true,
    params: merged(macdDefaults.params, s.macd?.params),
    style: merged(macdDefaults.style, s.macd?.style),
  };
  const periods = averages.map((a) => a.params.period);
  const { fast, slow, signal } = macd.params;
  return new Set(periods).size !== periods.length
    ? result.failure(fault(`averages: each period once, not ${periods.join(", ")}`))
    : fast >= slow
      ? result.failure(fault(`macd: its fast period must be below its slow, not ${fast} and ${slow}`))
      : pipe(
          periodOf(fast),
          result.flatMap((f) =>
            pipe(
              periodOf(slow),
              result.flatMap((sl) =>
                pipe(
                  periodOf(signal),
                  result.flatMap((sg) =>
                    pipe(
                      averages,
                      result.traverse((a) =>
                        result.map((n: Period) => ({ show: a.show, params: { period: n }, style: a.style }))(
                          periodOf(a.params.period),
                        ),
                      ),
                      result.map(
                        (ma): Resolved => ({
                          chart: s.chart ?? {},
                          averages: ma,
                          macd: {
                            show: macd.show,
                            params: { fast: f, slow: sl, signal: sg },
                            style: macd.style,
                          },
                          picture: merged(pictureDefaults, s.picture),
                        }),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
};

// Every value the settings give, the library's defaults among them: what `make chart-settings` writes, what a settings
// file can say (a period as a number).
export const everyValue = (r: Resolved) => ({
  chart: effective(r.chart),
  averages: r.averages.map((a) => ({
    show: a.show,
    params: { period: Number(a.params.period) },
    style: a.style,
  })),
  macd: {
    show: r.macd.show,
    params: {
      fast: Number(r.macd.params.fast),
      slow: Number(r.macd.params.slow),
      signal: Number(r.macd.params.signal),
    },
    style: r.macd.style,
  },
  picture: r.picture,
});

// the colours the settings name, every value that is a palette's name (cl-…), each once
export const coloursOf = (r: Resolved): readonly string[] => {
  const walk = (v: unknown): readonly string[] =>
    typeof v === "string"
      ? v.startsWith("cl-")
        ? [v]
        : []
      : Array.isArray(v)
        ? v.flatMap(walk)
        : typeof v === "object" && v !== null
          ? Object.values(v).flatMap(walk)
          : [];
  return [...new Set(walk(everyValue(r)))];
};

// The palette (palette.json, its one home): each name, cl-…, its light and its dark colour, #RRGGBB; the settings' colours
// are names of it.
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "a colour is #RRGGBB");
export const paletteSchema = z.record(z.string().regex(/^cl-[A-Za-z0-9-]+$/), z.tuple([hex, hex]));
export type Palette = z.output<typeof paletteSchema>;
