// The adapter from a page's marks, the file --marks gives, to @qi/chart's (docs/designs/design-chart-marking-2026-10-25.md):
// the file says what a picture marks, each a value its maker computed, and nothing of how it looks: its levels (a
// price and its text), its points (a time, a price, a text), its spans (the K-lines from one time to another, a band
// of prices), its gaps (a band of prices no K-line entered, from the time it was made on) and its moves (from a point
// to a point).
// Here they are put on the run's K-lines by their times, their prices at the file's scale, and given their look: a level
// a dashed line across the K-lines with its text at the right end; a span a filled box; a gap a box in the gap's
// colour from its K-line to the last, its text in it at its start; a point a dot, its text above
// it where it is its K-line's high, below where it is its low; a move a blue line. Each a layer of its own, named by its
// text. A time no K-line's is a fault.

import { pipe, type QiError, type Result, result } from "@qi/base";
import { type MarkLayer, type Marks, marksSchema, type XAxis } from "@qi/chart";
import { decode } from "@qi/core";
import { z } from "zod";
import { calendar, epoch } from "./read.ts";

export type MarksError = QiError<"CHART_MARKS", "VALIDATION">;

const fault = (message: string): MarksError => ({
  category: "VALIDATION",
  code: "CHART_MARKS",
  message,
  context: {},
});

// a time as the data has it, YYYY-MM-DD HH:MM:SS, read as the K-lines' are
const time = z
  .string()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$/)
  .refine(calendar, "a day of the calendar and a time of a day");
const price = z.number().int();
const text = z.string().min(1);
const point = z.object({ time, price }).strict();

export const pictureSchema = z
  .object({
    picture: text,
    // the run it is drawn on: the instrument and the period of its bars
    instrument: text,
    period: text,
    // its prices are the price times it
    scale: z.number().int().positive(),
    // the K-lines it is of, the first's time and the last's
    from: time,
    to: time,
    levels: z.array(z.object({ price, text }).strict()).readonly().default([]),
    points: z.array(z.object({ time, price, text }).strict()).readonly().default([]),
    spans: z
      .array(z.object({ from: time, to: time, low: price, high: price, text }).strict())
      .readonly()
      .default([]),
    gaps: z
      .array(z.object({ from: time, low: price, high: price, text }).strict())
      .readonly()
      .default([]),
    moves: z
      .array(z.object({ from: point, to: point, text }).strict())
      .readonly()
      .default([]),
  })
  .strict();
export type Picture = z.output<typeof pictureSchema>;

// A picture's marks on the K-lines `xs`, whose prices are at `scale` (the run's).
export const marksOf =
  (xs: XAxis, scale: number) =>
  (p: Picture): Result<Marks, MarksError> => {
    const at = new Map(xs.map((k, i) => [k.date, i]));
    const place = (t: string): Result<number, MarksError> =>
      result.fromNullable(() => fault(`the marks of ${p.picture}: the time ${t} is no K-line's`))(
        at.get(epoch(t)),
      );
    const real = (v: number): number => v / p.scale;
    const last = xs.length - 1;
    const levels = p.levels.map(
      (l, i): Result<MarkLayer, MarksError> =>
        result.success({
          key: `level:${i}`,
          name: l.text,
          on: true,
          marks: [
            {
              kind: "line",
              from: { at: 0, price: real(l.price) },
              to: { at: last, price: real(l.price) },
              colour: "cl-level",
              width: 1,
              dashed: true,
            },
            {
              kind: "text",
              at: { at: last, price: real(l.price) },
              text: l.text,
              anchor: "left",
              colour: "cl-level",
              size: 12,
            },
          ],
        }),
    );
    const spans = p.spans.map((s, i) =>
      pipe(
        result.sequence([place(s.from), place(s.to)]),
        result.map(
          ([from = 0, to = 0]): MarkLayer => ({
            key: `span:${i}`,
            name: s.text,
            on: true,
            marks: [
              {
                kind: "box",
                from,
                to,
                low: real(s.low),
                high: real(s.high),
                colour: "cl-center",
                opacity: 0.3,
                border: false,
              },
            ],
          }),
        ),
      ),
    );
    const gaps = p.gaps.map((g, i) =>
      pipe(
        place(g.from),
        result.map(
          (from): MarkLayer => ({
            key: `gap:${i}`,
            name: g.text,
            on: true,
            marks: [
              {
                kind: "box",
                from,
                to: last,
                low: real(g.low),
                high: real(g.high),
                colour: "cl-gap",
                opacity: 0.35,
                border: false,
              },
              {
                kind: "text",
                at: { at: from, price: real((g.low + g.high) / 2) },
                text: g.text,
                anchor: "right",
                colour: "cl-gap-text",
                size: 12,
              },
            ],
          }),
        ),
      ),
    );
    const points = p.points.map((q, i) =>
      pipe(
        place(q.time),
        result.map((x): MarkLayer => {
          // its K-line's low, at the run's scale, to say which side its text goes
          const low = xs[x]?.low;
          const below = low !== undefined && q.price * scale === low * p.scale;
          return {
            key: `point:${i}`,
            name: q.text,
            on: true,
            marks: [
              { kind: "dot", at: { at: x, price: real(q.price) }, colour: "cl-ink", size: 3 },
              {
                kind: "text",
                at: { at: x, price: real(q.price) },
                text: q.text,
                anchor: below ? "below" : "above",
                colour: "cl-ink",
                size: 12,
              },
            ],
          };
        }),
      ),
    );
    const moves = p.moves.map((m, i) =>
      pipe(
        result.sequence([place(m.from.time), place(m.to.time)]),
        result.map(
          ([from = 0, to = 0]): MarkLayer => ({
            key: `move:${i}`,
            name: m.text,
            on: true,
            marks: [
              {
                kind: "line",
                from: { at: from, price: real(m.from.price) },
                to: { at: to, price: real(m.to.price) },
                // blue, apart from the candles' red and green
                colour: "cl-state-draw",
                width: 2,
                dashed: false,
              },
            ],
          }),
        ),
      ),
    );
    return pipe(
      result.sequence([...levels, ...spans, ...gaps, ...points, ...moves]),
      result.flatMap((layers) =>
        pipe(
          decode(marksSchema)({ contract: "qi-marks/1", layers }),
          result.mapError((e) => fault(`the marks of ${p.picture}: ${e.message}`)),
        ),
      ),
    );
  };

// the positions of the picture's first and last K-lines, the K-lines its static picture draws
export const shown =
  (xs: XAxis) =>
  (p: Picture): Result<readonly [number, number], MarksError> => {
    const at = new Map(xs.map((k, i) => [k.date, i]));
    const place = (t: string): Result<number, MarksError> =>
      result.fromNullable(() => fault(`the picture ${p.picture}: the time ${t} is no K-line's`))(
        at.get(epoch(t)),
      );
    return pipe(
      result.sequence([place(p.from), place(p.to)]),
      result.map(([a = 0, b = 0]): readonly [number, number] => [a, b]),
    );
  };

// the marks' file, read where it enters
export const picture = (v: unknown): Result<Picture, MarksError> =>
  pipe(
    decode(pictureSchema)(v),
    result.mapError((e) => fault(`a picture's marks: ${e.message}`)),
  );
