// Marks on a chart (docs/designs/design-chart-marking-2026-10-25.md): a small DSL of its own, separate from the
// chart's (dsl.ts), with four primitives (text, dot, line, box) placed by K-line position and price like the chart's.
// Marks come in layers, each with its own switch on the page. This file holds their contract, qi-marks/1. A page
// gives marks before the chart is drawn (MARKS), or a caller adds a layer to a chart already drawn (MARKING); either
// way they are decoded with this schema first, so the engines trust what they get.

import { type QiError, type Result, result } from "@qi/base";
import { z } from "zod";
import { colourSchema, opacitySchema, widthSchema } from "./schemas.ts";

// a K-line's number on the x-axis
const position = z.number().int().nonnegative();
// a price as the chart's DSL takes it: the real price
const price = z.number().finite();

export const markPointSchema = z.object({ at: position, price }).strict().readonly();

const textSchema = z
  .object({
    kind: z.literal("text"),
    at: markPointSchema,
    text: z.string().min(1),
    // which side of its point the text is on
    anchor: z.enum(["above", "below", "left", "right"]),
    colour: colourSchema,
    // in pixels
    size: z.number().positive().max(48).default(12),
  })
  .strict()
  .readonly();

const dotSchema = z
  .object({
    kind: z.literal("dot"),
    at: markPointSchema,
    colour: colourSchema,
    // its radius in pixels
    size: z.number().positive().max(20).default(3),
  })
  .strict()
  .readonly();

const lineSchema = z
  .object({
    kind: z.literal("line"),
    from: markPointSchema,
    to: markPointSchema,
    colour: colourSchema,
    width: widthSchema.default(1),
    dashed: z.boolean().default(false),
  })
  .strict()
  .readonly();

// over K-lines `from` to `to`, both drawn whole, as the chart's boxes are
const boxSchema = z
  .object({
    kind: z.literal("box"),
    from: position,
    to: position,
    low: price,
    high: price,
    colour: colourSchema,
    opacity: opacitySchema.default(0.25),
    border: z.boolean().default(false),
  })
  .strict()
  .readonly()
  .refine(
    (b) => b.from <= b.to && b.low <= b.high,
    "a box from its first K-line to its last, its low to its high",
  );

export const markSchema = z.discriminatedUnion("kind", [textSchema, dotSchema, lineSchema, boxSchema]);

export const markLayerSchema = z
  .object({
    key: z.string().min(1),
    name: z.string().min(1),
    // on at first
    on: z.boolean().default(true),
    marks: z.array(markSchema).min(1).readonly(),
  })
  .strict()
  .readonly();

export const marksSchema = z
  .object({
    contract: z.literal("qi-marks/1"),
    layers: z.array(markLayerSchema).readonly(),
  })
  .strict()
  .readonly()
  .refine((m) => new Set(m.layers.map((l) => l.key)).size === m.layers.length, "each layer's key its own");

export type MarkPoint = z.output<typeof markPointSchema>;
export type Mark = z.output<typeof markSchema>;
export type MarkLayer = z.output<typeof markLayerSchema>;
export type Marks = z.output<typeof marksSchema>;

export type MarkingError = QiError<"CHART_MARKS", "VALIDATION">;

// The marks, checked against a chart of `count` K-lines: every position must be one of its K-lines, or the first
// that is not is refused (a mark past them would be drawn outside the plot).
export const marksOn =
  (count: number) =>
  (m: Marks): Result<Marks, MarkingError> => {
    const past = m.layers
      .flatMap((l) =>
        l.marks.flatMap((x) =>
          x.kind === "box" ? [x.from, x.to] : x.kind === "line" ? [x.from.at, x.to.at] : [x.at.at],
        ),
      )
      .find((at) => at >= count);
    return past === undefined
      ? result.success(m)
      : result.failure({
          category: "VALIDATION",
          code: "CHART_MARKS",
          message: `a mark at K-line ${past}, past the chart's ${count}`,
          context: { at: past, count },
        });
  };
