# The rules of the visualization's work

qi-v2-visualization: `@qi/chart`, the 缠论 drawing library, its one product, and the chart app, its own tool, copied
here at version 1.8; version 2, online, is made here and released whole as 2.0.0, then 2.0.1; version 3, the structure
on 缠论's contract `chanlun` 3.1.0, as 3.0.0 (`README.md`).
These are its standing rules, for an agent of any kind; the format of this file is the kit's (`agents/README.md`).

## The session

**Read first.**

1. `docs/opening.md`: where the last session stopped, what is open for the owner, the next task, and the files that task needs. Read those files, and no others, before starting.
2. `docs/milestones.md`: what the work is for.
3. `docs/process.md`: how a session starts and ends, and where each rule lives.

Read the others only when the task touches them: `dev/ts/STYLE.md` before writing code; `docs/designs/design-chart-lib-2026-10-24.md` (the library, its versions, version 2 among them), `design-chart-app-2026-10-24.md` (the app), `design-engines-2026-10-24.md`, `design-chart-marking-2026-10-25.md`; `dev/docs/lib.md` (the libraries); `dev/ts/lib/chart/README.md` (the product, as a taker takes it) and `dev/ts/app/chart/README.md` (the app, the project's own tool).

**The rules.**

- **The owner's local file**: `todo.md`, never committed.
- **The repository.** This folder is on `main`; its remote is `origin`, `zhifengzhang-sz/qi-v2-visualization` on GitHub, public; pushed after a commit.
- **What it takes, and from where**: the tools from the flake; 缠论's contract by the flake input `contracts`, the market data contract by `market`; `@qi/base` and `@qi/core` by the flake input `qi-v2-ts`, at its tag; the contracts' vectors with them, the structure the checks draw. The library takes what it draws from its caller: the market data's K-lines and, beside them, a run of 缠论's contract over them. The app takes no published results until they name the K-lines they were made from. No file of another project is reached by a path; everything taken is public, read with no login.

## Every role

- **The library is the library, the app is the app.** `@qi/chart` knows only its contracts (its components, each a Zod schema, and 缠论's contract) and draws them; it computes no structure, and does every computation its display needs. The app is the adapter from a producer to the contracts. The DSL first: an engine implements the primitives only.
- **The design first**, and the code checked against it after every change: a design the code does not follow is a bug. Every page is looked at in both engines on the same view; a difference between them is a bug in one.
- **Code** follows `dev/ts/STYLE.md`; Biome formats it before a check.
- **The test data is public**: `test/data/` holds only market data whose source allows it, with its source named; no private data is committed.
- **The project's secrets**: none of its own, and nothing it reads needs a login; a push uses the person's own access, never printed or committed.
