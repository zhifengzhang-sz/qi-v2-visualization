// The tv page's layers, qi-layers/1 (docs/designs/design-chart-lib-2026-10-24.md, The engines): what the page can
// turn on and off. A layer is some series of the description (qi-chart/1), by id, plus markers on the candles. Some
// layers stand apart (K线, 成交量, the add-ons); the others are grouped by level, each level with one switch for all its layers. A fine
// layer shows only while fewer than `fine` K-lines are in view. The legend lists the series whose value at the
// pointer it shows, with name and format. The choice is the price distributions: at most one shown, picked in a
// pull-down. The tv engine (engine/tv.ts) follows these; nothing here is computed.

import { z } from "zod";
import { markerSchema } from "./description.ts";
import { legendShape } from "./dsl.ts";

export const layerSchema = z
  .object({
    name: z.string().min(1),
    // the series it shows, by id
    series: z.array(z.string().min(1)).readonly(),
    // the markers it puts on the candles
    markers: z.array(markerSchema).readonly(),
    // on at first
    on: z.boolean(),
    // shown only while fewer than `fine` K-lines are in view
    fine: z.boolean(),
  })
  .strict()
  .readonly();

export const levelSchema = z
  .object({
    level: z.number().int().nonnegative(),
    // its switch's colour, a palette name
    colour: z.string().min(1),
    on: z.boolean(),
    items: z.array(layerSchema).readonly(),
  })
  .strict()
  .readonly();

// a series in the legend: its id, with its legend entry (dsl.ts)
export const legendEntrySchema = z
  .object({ series: z.string().min(1), ...legendShape })
  .strict()
  .readonly();

export const layersSchema = z
  .object({
    contract: z.literal("qi-layers/1"),
    fine: z.number().int().positive(),
    // the decimals of the prices the legend shows
    precision: z.number().int().nonnegative(),
    apart: z.array(layerSchema).readonly(),
    levels: z.array(levelSchema).readonly(),
    legend: z.array(legendEntrySchema).readonly(),
    // the price distributions: at most one shown, picked in a pull-down by name; none at first
    choice: z
      .object({ name: z.string().min(1), items: z.array(layerSchema).readonly() })
      .strict()
      .readonly(),
  })
  .strict()
  .readonly();

export type Layer = z.output<typeof layerSchema>;
export type Level = z.output<typeof levelSchema>;
export type Layers = z.output<typeof layersSchema>;
