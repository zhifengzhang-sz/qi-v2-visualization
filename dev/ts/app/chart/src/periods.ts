// 周期: the same bars at other periods, each run its own folder and pages (make chart SET= OUT=), given as
// NAME=DIR,NAME=DIR,… with this run's folder among them; each page's pull-down, its names and, for each, the page of
// the same engine in that folder, relative to this one.

import { type Result, result } from "@qi/base";

export type Periods = {
  // this page's period, by its name; none when no periods are given
  readonly current: string;
  readonly pages: readonly { readonly name: string; readonly href: string }[];
};

const bare = (dir: string): string => dir.replace(/\/+$/, "");

// the path of `file` in the folder `to` from the folder `from`, both of one root: up from `from` to where they part,
// down to `to`
const relative =
  (from: string, to: string) =>
  (file: string): string => {
    const a = from.split("/").filter((x) => x !== "");
    const b = to.split("/").filter((x) => x !== "");
    const common = a.findIndex((x, i) => x !== b[i]);
    const shared = common === -1 ? Math.min(a.length, b.length) : Math.min(common, b.length);
    return [...a.slice(shared).map(() => ".."), ...b.slice(shared), file].join("/");
  };

export const periods =
  (given: string | undefined, dir: string) =>
  (file: string): Result<Periods, string> => {
    if (given === undefined) return result.success({ current: "", pages: [] });
    const pairs = given.split(",").map((p) => ({
      text: p,
      name: p.slice(0, Math.max(0, p.indexOf("="))),
      dir: bare(p.slice(p.indexOf("=") + 1)),
    }));
    const bad = pairs.find((p) => p.name === "" || p.dir === "");
    const here = pairs.find((p) => p.dir === bare(dir));
    return bad !== undefined
      ? result.failure(`--periods: ${bad.text} is not NAME=DIR`)
      : new Set(pairs.map((p) => p.name)).size !== pairs.length
        ? result.failure("--periods: a name given twice")
        : here === undefined
          ? result.failure(`--periods: this folder, ${dir}, is not among them`)
          : result.success({
              current: here.name,
              pages: pairs.map((p) => ({ name: p.name, href: relative(dir, p.dir)(file) })),
            });
  };
