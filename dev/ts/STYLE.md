# The code style rule

The rule for every package under `dev/ts/`: code written as composed functions, not imperative steps, and regulated by the packages themselves, not by lint alone. The design behind it: `dev/docs/lib.md`. Every brief for code points here, and `reviewer` checks code against it.

The style is regulated by five things, in this order; lint is used only for the structure:

1. **The API.** The easiest way to write anything is the functional one: curried, data-last functions composed with `pipe` and `flow`. There is no `unwrap` or `getValue`: the ways out of a `Result` are `result.match` and `result.getOrElse` (a match whose failure side gives a value), both total. A `Task` is run by `task.run`, once, in the app's `main`; `run` never rejects, a throw where none is allowed becoming a `QiError` of code `DEFECT`. A `Task` cannot be called by hand: the function inside it is kept under a key `base` does not export, so `task.run` is the only way to start one: the types refuse any other, short of a cast that reaches the key by reflection, which the reviewer reads for. A step on the side, a log line, is `task.tap`, which passes the value on unchanged.
2. **The types.** Failure is a value, `Result<T, E>`; an effect is a value, `Task<T, E>`, a function not yet run. What crosses a boundary is `Json`.
3. **The structure.** Each package is split into a pure part and an edge part (`src/edge/`). The pure part imports no effect (Node's and Bun's modules, `fetch`, `process`, `console`, the clock, timers, `crypto`, `Math.random`); the edge part holds every effect, each a `Task`, and the boundaries where an exception enters (`result.tryCatch`). Biome checks the imports and the globals (`dev/ts/biome.json`).
4. **The laws.** `base`'s specification is the functor laws (for the value and the error side) and the monad laws, for `Result` and `Task`, tested as properties (fast-check) in its home, `qi-v2-ts`. A module's specification is its contract: a Zod schema with test vectors (`core`).
5. **This rule**, read by the writer and by the reviewer.

## The rules

- **Decode at the boundary.** Input from outside (a file, a command line, a model's reply) enters only through a Zod schema, as a `Result`. Inside, values are typed; nothing is checked twice.
- **Total functions.** A function returns a value for every input of its type: no `throw`, no `try` outside the edge, no partial lookup left unchecked (`array[i]` and `map.get(k)` are typed as possibly `undefined`, `noUncheckedIndexedAccess`, and go through `result.fromNullable` at once).
- **No mutation.** `const` only; `readonly` fields and arrays; a new value instead of a changed one (spread, `map`, `filter`, `reduce`). No `let`, no `for` or `while`, no `push`, no assignment to a field. The tools check `let` and the loops; `push` and assignment to a field are not checked (the reviewer reads for them).
- **No classes, no `this`.** Data is plain readonly objects; behaviour is functions over them; a module is a namespace of functions.
- **Effects at the edge.** A pure function takes what an effect would give as an argument: the time (a date is parsed at the edge), a file's text, a model's vectors. `Task` composes effects before they run; `task.run` runs them once, in the app's `main`.
- **Errors as data.** A failure is a `QiError` (`code`, `message`, `category`, a `Json` context), never an exception; an exception from a library is caught where it enters (`task.tryPromise`, `result.tryCatch`) and becomes a `QiError`. `base` gives the shape and the shared categories, nothing of any use: each module defines its own error type, `QiError` narrowed to its codes (as `ConfigError` in `core`), and returns it, so that a handler knows every case: `base`'s error is like an abstract class, and each user has its own (`qi-v2-ts`'s `README.md`, `@qi/base`).
- **Small names, one home.** A fact is written once (a list of categories, a schema); types are derived from it (`typeof list[number]`, `z.infer`).
- **Comments say why**, not what; a module's header says what it is and where its rule is.

**Scope.** The rules hold in every package's `src/`. In `src/edge/`, `try` and the effects are allowed; classes, `throw`, `let` and loops are not. The tests (`test/`) may record what an effect did (`calls.push`): they observe effects, they are not the code under the rule.

## Checked by tools

| What | How |
|---|---|
| no effect in a pure part | Biome `noRestrictedImports`, `noRestrictedGlobals`, the plugin `no-random`, on `*/src/**` outside `*/src/edge/**` |
| no `class`, `throw`, `try`, `let`, loops | Biome GritQL plugins (`dev/ts/biome/`); in `src/edge/`, `class`, `throw`, `let` and loops |
| that every check fires, and only where it should | `biome/verify.ts`: each rule on `biome/fixture/violations.ts`, nothing on `biome/fixture/clean.ts` |
| the laws, the properties | `vitest` with fast-check, `bun run test`; base's laws in `qi-v2-ts` |
| types | `tsc --noEmit`, `strict` and `exactOptionalPropertyTypes` |
