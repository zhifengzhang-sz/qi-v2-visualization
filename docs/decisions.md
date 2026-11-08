# The decisions

Each decision once: its date, who decided (the owner, or the session as a proposal until the owner decides), the
decision and its reason in a line each, and the documents it shapes. The documents state what stands; this file
says who decided it and why. A decision still open is under Open, with the proposal.

This repository's history begins at `qi-chart` 2.0.1's tree (2026-11-08, below): a commit an entry names from before
it, the first version's code or the one tagged `qi-chart-2.0.0`, is of the earlier history, which it does not hold.

## Decided

- **2026-09-25, the owner**, with the reviewer of the programme's structure (the project's first README). Five: a
  project of its own, not an app of another project; Lightweight Charts v5 the drawing library; the visualizer a
  consumer of the stream, folding bars and the model's output as the stream's record writer does; the gateway and the
  replay in another project; the model's own structures a fenced exception, off by default. The first, the second (as one of
  `@qi/chart`'s two engines), the fourth stand; the third and fifth are replaced by the entry of 2026-10-28. Shapes:
  `README.md`, `docs/milestones.md`, `docs/designs/design-engines-2026-10-24.md`.
- **2026-10-28, the owner.** The project emptied and set up to the practices of every qi-v2 project (`qi-v2-nix`,
  `practices.md`: the flake, the kit, the Makefile, the state documents); `@qi/chart` and the chart app copied into it
  at version 1.8 from the project where they were made, with what they take (`@qi/base`, `@qi/core`,
  `@qi/indicator`, the style's Biome plugins) and the designs their code cites; that project keeps its own copy, its
  version 1, for its own work. This project makes `@qi/chart` 2.0, online, which a live chart takes only from 2.0.
  It replaces the old README's third and fifth decisions: what is drawn is 缠论's structure by 缠论's contract
  (`@qi/chanlun`), not the market model API's vocabulary folded from the model's envelopes; the fold, its adapter and
  the overlay of the first version (`typescript/chart`, in git's history) are gone. What they gave, and how it is kept:
  a picture of the stream (version 2, from the stream its caller gives); the fold checked against the record at every bar
  (lost until version 2 reads the stream, then a check of its own). Why: `@qi/chart` is what draws 缠论's structure,
  built and checked, and the first version was outdated. Shapes: every file of this project.
- **2026-10-28, the session** (a proposal until the owner decides). The lock of the program that then computed the
  structure names its version 0.2.0: without its streaming option the same files as 0.1.0, which the copied app was
  made against; with it, the answer per bar that version 2 needs. The test data is 4,000 public BTCUSDT minutes from
  Binance US, in the app's input form: the copied checks drew a day of private data, and their marks file (that day's
  prices and a text not public) is not copied; `test/data/marks.json`, marks on the public minutes, keeps
  `chart-check` drawing marks by every engine. Left behind with the other libraries and apps of the project the code
  came from: their README, and of `dev/docs/lib.md` all but the libraries copied. Shapes: that program's lock (gone
  since 2026-11-01), `test/data/`, `Makefile`, `dev/docs/lib.md`.
- **2026-11-01, the owner.** The structure comes only from the published results: this project takes the product
  `chanlun-results`, records that conform to the contract `chanlun`, pinned by `results.lock`, decoded by the
  contract's own `decodeRun`, and knows nothing of what made them. Running a program, a structure given, the reading of
  that program's CSV files and Docker are gone; a chart of bars alone stays. The project states what it owns, gives
  and takes in `PRODUCTS.md`. The inputs `qi-v2` and `kit` are taken at their latest with it, which brings `nixpkgs`.
  Why: the qi-v2 projects are being decoupled, each taking another only as a published
  product pinned by its lock, so developers here work seeing only results that conform to the contract. Shapes:
  `results.lock`, `PRODUCTS.md`, `flake.nix`, `flake.lock`, `Makefile`, `dev/scripts/`, `dev/ts/app/chart/`, `README.md`,
  `agents/`, `docs/designs/design-chart-app-2026-10-24.md`.
- **2026-11-02, the owner.** The results are taken at 0.2.0. Why: the decoupling of the entry before this one; 0.2.0
  states each set's scale in the product's own lock, so the scale in `results.lock` is no longer a value added by hand;
  its newest SPY set runs to 2026-10-30. Shapes: `results.lock`, `docs/opening.md`.
- **2026-11-08, the owner.** The project's one product is the library `@qi/chart` (`qi-chart`); the chart app is the
  project's own tool, not a product, its flake package `chart` that tool's build; no product or state document names,
  by project, a taker of the library or a producer of version 2's input. Why: a product is what another project
  takes, defined by its contract and its own interface, naming no taker and no use of its output; an app as a product
  makes its own choices (the form of its input, its pages, its packaging) every taker's dependency, while a library
  gives the drawing alone and leaves the input and the output to the app that takes it. Shapes: `PRODUCTS.md`,
  `README.md`, `agents/rules.md`, `dev/ts/app/chart/README.md`, `docs/milestones.md`, `docs/opening.md`,
  `docs/designs/design-chart-lib-2026-10-24.md`, `docs/designs/design-chart-app-2026-10-24.md`.
- **2026-11-08, the owner.** The first release here is `qi-chart` 2.0.0, version 2 whole, by tag
  (`qi-chart-2.0.0`): one commit holding the version and its documents, tagged, and nothing committed after its push.
  1.8.0, the copied code's version, is not released. Why: nothing takes 1.8.0, so a release of it would serve no
  taker; version 2 is whole before it is published. It closes the Open entry on the versions' numbers. Shapes:
  `PRODUCTS.md`, `docs/milestones.md`; at the release, `flake.nix`, `dev/ts/lib/chart/package.json`,
  `dev/ts/lib/chart/README.md`.
- **2026-11-08, the owner.** Version 2 takes the K-lines and their structure from its caller, one K-line at a time,
  appended or the forming one replaced; no product of the structure per bar is needed. Why: the library draws what
  its caller gives and computes no structure. It closes the Open entry on how version 2 takes the structure per bar.
  Shapes: `docs/milestones.md`, `docs/opening.md`, `docs/designs/design-chart-lib-2026-10-24.md` (Versions, 2), and
  version 2's design, to come.
- **2026-11-08, the owner.** The chart app keeps `chanlun-results` 0.2.0 and the contract `chanlun` 1.1.0 for its
  static charts until the owner ends it; the leave covers the library's batch too, taking `chanlun` 1.1.0's K-line as
  the input of those charts, and ends when the app's ends. Why: its static charts work on them today, 0.2.0's runs
  holding their K-lines. Shapes: `results.lock`, `flake.nix` (the input `contracts`), `docs/opening.md`,
  `docs/designs/design-chart-online-2026-11-08.md` (The two components; What 2.0.0 holds, and what is left).
- **2026-11-08, the owner.** What a project takes from another conforms to the contracts of `qi-v2-contracts`: in 2.0.0
  the library's K-line is `market` 1.1.0's, on the online path and, in the place of the library's own plain bar, as an
  input of the static path; `chanlun` 1.1.0's is kept only by the leave of the entry on the app's static charts, the
  batch's input for them. Why: the contracts are how the projects communicate with each other, and a record of the
  library's own is a language no other project shares. Market K-lines made from the app's bars as its run holds them
  become the same bars, so a chart of bars alone keeps its page data. Shapes:
  `docs/designs/design-chart-online-2026-11-08.md`, `docs/designs/design-chart-lib-2026-10-24.md` (Versions, 2).
- **2026-11-08, the owner.** Every part takes the newest version of each product it takes; an older one only by the
  owner's leave, which covers only the chart app's static charts on `chanlun-results` 0.2.0 and `chanlun` 1.1.0, and the
  library's batch taking `chanlun` 1.1.0's K-line for them. Why: an upgrade updates the whole system. Shapes:
  `docs/designs/design-chart-online-2026-11-08.md` (the app's online page on `@qi/chart` 2.0.0 and `market` 1.1.0),
  `docs/opening.md`.
- **2026-11-08, the owner.** In 2.0.0 a K-line whose date is not a whole second is refused, its fault named. Why: both
  engines' page data, and the static path's, hold whole seconds. The contract allows a date in milliseconds, so a
  later version takes such dates, as the entry before this one asks. Shapes:
  `docs/designs/design-chart-online-2026-11-08.md` (At start-up; What 2.0.0 holds, and what is left).
- **2026-11-08, the session** (the owner left the choice to the session). For
  2.0.0, the static charts "byte for byte" means that each static chart's page data (`qi-chart/1`, `qi-layers/1`,
  `qi-d3fc/1`) and its TikZ picture are 1.8.0's bytes, and each static page draws the same pixels; the page files
  differ by the code they carry. Why: a page inlines the library's bundle and its engine's script, so the files stay
  the same only if the online path reaches a drawn chart through the handles a static page has already; the one that
  redraws, `REDRAW`, draws the chart anew from the whole page data at the range of places it had, so an appended
  K-line would not be followed and the view's rule would be lost; what a static chart is, what each engine is given and
  draws, is what stays. Shapes: `docs/designs/design-chart-online-2026-11-08.md` (guarantee 1, Why a page file
  changes; How the release is checked, 2).
- **2026-11-08, the owner.** The library has two components: the batch, which draws a chart whole, as 1.8, and the
  online one, which starts from a chart's components as the batch takes them and draws nothing whole. How a caller
  uses them, the batch first and then the online one, is not the library's: it is an example in the product's README.
  Why: the batch is done already, and how the library is used is not the library's business. With it, version 2's
  design is built: the online component in the caller's page, taking `market` 1.1.0's K-lines and ongoing K-lines as
  records the caller has decoded; `complete` and `forming` each give a step whose change is each engine's page data
  where it changed, made by the batch's functions and applied by the engine's `UPDATE`; 2.0.0 holds K线, 成交量 and the
  caller's add-ons drawing with series, and the structure enters later, since no published product gives it one
  K-line at a time yet. Shapes: `docs/designs/design-chart-online-2026-11-08.md`,
  `docs/designs/design-chart-lib-2026-10-24.md` (Versions, 2), `dev/ts/lib/chart/README.md` (at the build),
  `docs/milestones.md`.
- **2026-11-08, the session** (the owner left the choice to the session). An add-on on an online chart is made
  again whole at each update, O(n) in the K-lines, not stepped, and its series are replaced whole. Why: a step of each
  indicator beside its whole form would be a second home for one value, which may round otherwise (MACD's powers);
  replaced whole, its series are those of the K-lines drawn whole whatever values it gives; its cost is measured in the
  release's check, and a step is left for a later version. Shapes:
  `docs/designs/design-chart-online-2026-11-08.md`.
- **2026-11-08, the session** (the owner left the choice to the session). The chart app gains an online page, a
  replay of a run of its bars, on `@qi/chart` 2.0.0 and `market` 1.1.0, for the online path's check in a browser and
  for its looking at in both engines. Why: the online path has no other caller here; the app is the adapter from a
  producer to the contracts, and the replay's source is its own. Shapes:
  `docs/designs/design-chart-online-2026-11-08.md` (What changes for the chart app).
- **2026-11-08, the owner** (on the session's proposal). In 2.0.0, each engine's change is cut from the batch's page
  data of the whole chart after the step, so an update makes the page data of every K-line again, O(n): measured about
  110 ms an update for 4,000 K-lines with MA and MACD (tv; d3fc 100 ms), 0.4 ms for 60. Drawing only what an update
  changes is left for a later version. Why: the page data with every tail applied are then the batch's by construction
  (guarantee 2), by the batch's own functions, with no second form of any drawing or indicator; the first path first.
  Shapes: `docs/designs/design-chart-online-2026-11-08.md` (What an update costs), `dev/ts/lib/chart/src/tails.ts`.
- **2026-11-08, the owner.** This project is public: it depends on no private project and names none in its files.
  Everything it takes can be taken by anyone with no login, over HTTPS or from a public registry; no tracked file
  names a private project, a short name standing for one, or what only one holds; a line that needs such a fact keeps
  it without the project (a data's source by its vendor, the results by `chanlun-results`, the libraries by
  `qi-v2-ts`). The git history is not rewritten (replaced by the entry below on the history begun anew). Why: what
  anyone reads in a public project is then all there is, and nothing in it points to what a reader cannot open.
  Shapes: every tracked file, `agents/rules.md`, `README.md`, `docs/process.md`, `dev/ts/lib/chart/README.md`.
- **2026-11-08, the owner.** The published results, `chanlun-results` on GHCR, are public: they are read with no login,
  by `crane` with no stored login, and the instructions for a GHCR login are gone. Why: the project's every input is
  then taken by anyone. Shapes: `README.md`, `docs/process.md`, `Makefile` (`results-fetch`), `dev/scripts/results.py`,
  `dev/scripts/locks-check.py`, `docs/designs/design-chart-app-2026-10-24.md` (The results).
- **2026-11-08, the owner.** `@qi/base` and `@qi/core` are taken from `qi-v2-ts`, their own home, a public project:
  its product `qi-v2-ts` 0.1.0, by the tag `qi-v2-ts-0.1.0`, the flake input `qi-v2-ts`, its `qi-v2` and `kit`
  following this project's; the copies here are removed. Why: one home, which every taker pins by tag; the copies held
  the same code (they differed only in comments) and took the same npm packages at the same versions, so taking the
  product changes no behaviour. It closes the Open entry on where they live. Shapes: `flake.nix`, `flake.lock`,
  `PRODUCTS.md`, `Makefile` (`qi-v2-ts-link`, `ts`), `dev/ts/`, `dev/docs/lib.md`, `dev/ts/lib/chart/README.md`.
- **2026-11-08, the owner.** `qi-chart` is released whole as 2.0.1, by the tag `qi-chart-2.0.1`: one commit holding the
  version and its documents, tagged, and nothing committed after its push. Why: the package's own files change (its
  README, its sources' comments, and base and core's comments from their home) while its code does not. Shapes:
  `flake.nix`, `dev/ts/lib/chart/package.json`, `PRODUCTS.md`, `dev/ts/lib/chart/README.md`.
- **2026-11-08, the owner.** The repository's history is begun anew, as `qi-v2-platform`'s was: after GitHub's own
  commit, one commit holds the tree of `qi-chart` 2.0.1's release, its documents brought up to date, and the tag
  `qi-chart-2.0.1` is made again on it; the earlier history is kept by the owner, private. It replaces the entry
  above's "the git history is not rewritten". Why: each of the 24 commits before 2.0.1's release holds a file that
  names a private project, and 8 of their messages name one; begun anew, what anyone reads in the repository, its
  history included, is all there is. No project takes `qi-chart` yet, so its release's tag is made again on the new
  history: the tag names the release, and its package is the same. Shapes: `docs/opening.md`, `docs/milestones.md`,
  and where a document names a commit from before it: `docs/decisions.md`,
  `docs/designs/design-chart-lib-2026-10-24.md` (Versions, 2), `docs/designs/design-chart-online-2026-11-08.md` (How
  the release is checked).
- **2026-11-08, the owner.** The licence is Apache 2.0, GitHub's `LICENSE` at the root; the package's own files (its
  `package.json`, its README) name it at its next release. Why: a public project says on what terms it is taken, and
  Apache 2.0 is `qi-v2-platform`'s; the package stays 2.0.1's until a release changes it. Shapes: `LICENSE`; at the
  next release, `dev/ts/lib/chart/package.json`, `dev/ts/lib/chart/README.md`.
- **2026-11-08, the owner.** The branch is `main`. Why: the new repository was made on `main`,
  every other qi-v2 project's branch, `qi-v2-platform`'s among them. Shapes: `agents/rules.md` (The repository).

## Open

<!-- an entry: - **The question.** The options. Proposed (the session, YYYY-MM-DD): the proposal. Shapes: `path`. -->

- **CI.** The first version's CI is gone with it. Proposed (the session, 2026-10-28): CI in the flake's shell, `make ts`
  and `make chart-check`, once the image can be read there. Shapes: `.github/workflows/`.
