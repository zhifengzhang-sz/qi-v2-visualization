// chart: the chart app (docs/designs/design-chart-app-2026-10-24.md): a run of bars, and 缠论's records beside them where
// it has them, read into the components of @qi/chart (read.ts), drawn by its engines as pages (page.ts), each carrying its input and making its description in the browser (describe.ts), each with its 周期, the same bars at other periods
// (periods.ts), with its add-ons, MA and MACD (indicators.ts); its command, src/edge/main.ts.

export {
  type Coming,
  comingFor,
  components,
  historyOf,
  klinesOf,
  type PageInput,
  type PageInputError,
  pageInput,
  pageInputSchema,
} from "./describe.ts";
export { indicators } from "./indicators.ts";
export { atScale, type Bar, barsFile, type InputError, parse, scales } from "./input.ts";
export {
  type MarksError,
  marksOf,
  type Picture,
  picture,
  pictureSchema,
  shown as pictureShown,
} from "./marks.ts";
export { d3fcPage, page } from "./page.ts";
export { type Periods, periods } from "./periods.ts";
export { barsAxis, barsOf, history, noRun, type ReadError, rows, runOf, type Structure } from "./read.ts";
export {
  coloursOf,
  everyValue,
  type Palette,
  paletteSchema,
  type Resolved,
  resolved,
  type Settings,
  type SettingsError,
  settingsSchema,
} from "./settings.ts";
