// One violation of each rule of dev/ts/STYLE.md, so that `make ts` can check every rule fires (biome/verify.ts).
// Never imported; kept out of the main check by its path.

import { readFileSync } from "node:fs";

class Box {}

let counter = 0;

for (const x of [1, 2]) {
  counter = counter + x;
}

try {
  readFileSync("x");
} catch {
  counter = 0;
}

export const stop = (): never => {
  throw new Error("no");
};

export const now = (): number => Date.now();

export const get = (): Promise<Response> => fetch("http://localhost");

export const roll = (): number => Math.random();

export default class {}

export { Box, counter };
