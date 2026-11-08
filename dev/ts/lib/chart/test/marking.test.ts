// The marks' contract, qi-marks/1 (marking.ts): its test vectors, what it takes, with its defaults, and what it refuses.

import { result } from "@qi/base";
import { decode } from "@qi/core";
import { describe, expect, it } from "vitest";
import { type Marks, marksOn, marksSchema } from "../src/index.ts";

const decoded = (v: unknown): Marks | undefined =>
  result.match(
    (m: Marks): Marks | undefined => m,
    (): Marks | undefined => undefined,
  )(decode(marksSchema)(v));

// one of each primitive, every value given but the defaults
const every = {
  contract: "qi-marks/1",
  layers: [
    {
      key: "level",
      name: "4129",
      marks: [
        {
          kind: "line",
          from: { at: 0, price: 4129 },
          to: { at: 239, price: 4129 },
          colour: "cl-level",
          dashed: true,
        },
        {
          kind: "text",
          at: { at: 239, price: 4129 },
          text: "4129（1/2线）",
          anchor: "right",
          colour: "cl-level",
        },
      ],
    },
    {
      key: "sideways",
      name: "10:46–10:54",
      on: false,
      marks: [{ kind: "box", from: 75, to: 83, low: 4128, high: 4130, colour: "cl-center" }],
    },
    { key: "low", name: "09:58", marks: [{ kind: "dot", at: { at: 27, price: 4094.14 }, colour: "cl-ink" }] },
  ],
};

describe("qi-marks/1", () => {
  it("takes one of each primitive, the defaults filled in", () => {
    expect(decoded(every)).toEqual({
      contract: "qi-marks/1",
      layers: [
        {
          key: "level",
          name: "4129",
          on: true,
          marks: [
            {
              kind: "line",
              from: { at: 0, price: 4129 },
              to: { at: 239, price: 4129 },
              colour: "cl-level",
              width: 1,
              dashed: true,
            },
            {
              kind: "text",
              at: { at: 239, price: 4129 },
              text: "4129（1/2线）",
              anchor: "right",
              colour: "cl-level",
              size: 12,
            },
          ],
        },
        {
          key: "sideways",
          name: "10:46–10:54",
          on: false,
          marks: [
            {
              kind: "box",
              from: 75,
              to: 83,
              low: 4128,
              high: 4130,
              colour: "cl-center",
              opacity: 0.25,
              border: false,
            },
          ],
        },
        {
          key: "low",
          name: "09:58",
          on: true,
          marks: [{ kind: "dot", at: { at: 27, price: 4094.14 }, colour: "cl-ink", size: 3 }],
        },
      ],
    });
  });

  it("takes no layers", () => {
    expect(decoded({ contract: "qi-marks/1", layers: [] })).toEqual({ contract: "qi-marks/1", layers: [] });
  });

  const layer = (marks: readonly unknown[], key = "k") => ({ key, name: "n", marks });
  const refused: readonly (readonly [string, unknown])[] = [
    ["another contract", { contract: "qi-marks/2", layers: [] }],
    ["two layers of one key", { contract: "qi-marks/1", layers: [every.layers[2], every.layers[2]] }],
    ["a layer with no marks", { contract: "qi-marks/1", layers: [layer([])] }],
    [
      "a kind it does not have",
      {
        contract: "qi-marks/1",
        layers: [layer([{ kind: "arrow", at: { at: 0, price: 1 }, colour: "cl-ink" }])],
      },
    ],
    [
      "an empty text",
      {
        contract: "qi-marks/1",
        layers: [
          layer([{ kind: "text", at: { at: 0, price: 1 }, text: "", anchor: "above", colour: "cl-ink" }]),
        ],
      },
    ],
    [
      "an anchor it does not have",
      {
        contract: "qi-marks/1",
        layers: [
          layer([{ kind: "text", at: { at: 0, price: 1 }, text: "t", anchor: "centre", colour: "cl-ink" }]),
        ],
      },
    ],
    [
      "a colour not of the palette",
      {
        contract: "qi-marks/1",
        layers: [layer([{ kind: "dot", at: { at: 0, price: 1 }, colour: "#ff0000" }])],
      },
    ],
    [
      "a position not a K-line's",
      {
        contract: "qi-marks/1",
        layers: [layer([{ kind: "dot", at: { at: 0.5, price: 1 }, colour: "cl-ink" }])],
      },
    ],
    [
      "a box from after its end",
      {
        contract: "qi-marks/1",
        layers: [layer([{ kind: "box", from: 5, to: 4, low: 1, high: 2, colour: "cl-ink" }])],
      },
    ],
    [
      "a box its low above its high",
      {
        contract: "qi-marks/1",
        layers: [layer([{ kind: "box", from: 4, to: 5, low: 3, high: 2, colour: "cl-ink" }])],
      },
    ],
    [
      "a field it does not have",
      {
        contract: "qi-marks/1",
        layers: [layer([{ kind: "dot", at: { at: 0, price: 1 }, colour: "cl-ink", label: "x" }])],
      },
    ],
  ];
  it.each(refused)("refuses %s", (_, v) => {
    expect(decoded(v)).toBeUndefined();
  });
});

describe("marks on a chart", () => {
  it("are taken where every position is one of its K-lines, and refused at the first past them", () => {
    const m = decoded(every);
    expect(m && marksOn(240)(m).tag).toBe("success");
    const past = m && marksOn(200)(m);
    expect(past?.tag === "failure" && past.error.message).toBe("a mark at K-line 239, past the chart's 200");
  });
});
