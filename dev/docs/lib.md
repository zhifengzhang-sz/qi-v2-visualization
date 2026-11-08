# The libraries: `@qi/indicator`, `@qi/chart`, and what they take

The TypeScript under `dev/ts/`: domain libraries and the apps that compose them, over the general libraries `@qi/base`
and `@qi/core`, taken from `qi-v2-ts` (`docs/decisions.md`). The code's style: `dev/ts/STYLE.md`.

**The rule**: the library is the library and an app is an app; app issues are not brought to the library, nor library
issues to the app. A library takes its input as plain data, through its contract; the app maps its own content into
that input, conforming the contract.

## Contracts

Each module is defined by its contract: input, output, invariants, errors. The contract is a Zod schema in TypeScript
and test vectors beside it (core's `Contract`): values a schema must accept or reject and, for a pure function, an
input with its expected output. What JSON Schema cannot say is in the schema's description and in the vectors, which
any language can run. Each module has its own error type, a `QiError` narrowed to its codes, an input that does not
fit among them.

The libraries publish no schema files: what they offer every app is core's `decode` (data checked against the schema
the app gives, and read through it) and `jsonSchema` (that schema written out, for an app that needs it); a schema of
a data file is its domain's, in the domain's library, never in the general ones.

What the languages make unequal is kept out at the boundary: every string written is well-formed Unicode; a pattern in
a published schema uses no `.`, `\s`, `\S` or `\d`, whose meaning differs between the languages that read the
contract; core's `jsonSchema` takes the side, `input` or `output`, so that a field with a default is optional in an
input's schema.

## Domain libraries and apps

The app of a domain uses the library of its domain: `app/chart` uses `@qi/chart`.

- **General libraries**, `@qi/base`, `@qi/core`: they know no domain (The rule, above); `qi-v2-ts`'s (base and core,
  below).
- **Domain libraries**, `dev/ts/lib/<domain>`, `@qi/<domain>`: a domain's schemas, contracts and pure functions, and
  its effects under `src/edge/`, for any app: `@qi/chart` (a 缠论 drawing library,
  `docs/designs/design-chart-lib-2026-10-24.md`, taking 缠论's contract), `@qi/indicator` (the indicators: the
  averages and MACD).
- **Taken from another project**: `@qi/chanlun`, 缠论's contract (`chanlun-1.1.0` of `qi-v2-contracts`, its
  `chanlun/SPEC.md`; the flake input `contracts`), linked at `dev/ts/node_modules/@qi/chanlun` by `make
  chanlun-link`, which `make ts` runs: outside Bun's workspaces (Bun cannot link into the store's read-only folder),
  so outside this project's Biome and style too, the contract having its own checks; `dev/ts/app/chart/src/read.ts`
  reads a run of the published results by its `decodeRun`. `@qi/market`, the market data contract (`market-1.1.0` of
  `qi-v2-contracts`, its `market/SPEC.md`; the flake input `market`), the K-lines `@qi/chart` takes, linked at
  `dev/ts/node_modules/@qi/market` by `make market-link`, which `make ts` runs, the same way.
- **Apps**, `dev/ts/app/<domain>`, `@qi/app-<domain>`: the edge only (the command, its files, its page), each
  composing its domain library with the others: the chart app, `@qi/app-chart` (`dev/ts/app/chart`,
  `docs/designs/design-chart-app-2026-10-24.md`).

## Layout, language and the way in

**Layout**: `dev/ts/lib/[indicator,chart]`, `dev/ts/app/chart`; `dev/scripts/` only scripts whose imports are the
standard library and outside packages.

**Language**: TypeScript. The toolchain is Bun, Biome (lint and format), vitest and Zod 4, all pinned in `flake.nix`.

**base and core.** `@qi/base` (Result, Task, QiError, pipe and flow) and `@qi/core` (decode, contract, config and log
over base) are `qi-v2-ts`'s product `qi-v2-ts`, taken by the flake input `qi-v2-ts` at its tag `qi-v2-ts-0.1.0`; what
they give, and how they are taken, is its `README.md`. They are linked at `dev/ts/node_modules/@qi/base` and
`@qi/core` by `make qi-v2-ts-link`, which `make ts` runs, each to its folder in the package (`@qi/base`, `@qi/core`),
so that core finds base, Zod and smol-toml in the package, as that README says they resolve: outside Bun's workspaces,
as the contracts are, and outside this project's Biome, style and tests, the product having its own. Each link is
one library's, not the README's `node_modules/@qi`, since this project has `@qi/` packages of its own; and Zod is not
linked from the package, as that README asks, since this project's packages take Zod themselves, pinned by
`dev/ts/bun.lock` at the same version: in the dev workspace core's Zod is the package's and theirs is Bun's, two
copies of Zod 4.1.12, as the contracts each carry their own; core's `decode` calls the schema's own `safeParse`, so a
schema of either copy decodes alike. The packages `qi-chart` and `chart` hold one Zod. The flake
package `qi-chart` copies them from the package with smol-toml and Node's types, beside them there; `chart`, with
smol-toml.

**Style.** Regulated by API, types, structure, laws and a written rule, `dev/ts/STYLE.md`; lint is used only for the
structure. Each module splits into a pure part (no imports of effects) and an edge part, checked by Biome's
`noRestrictedImports`.
