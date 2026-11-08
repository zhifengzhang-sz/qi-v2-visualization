Opening for the next session, written 2026-11-09 by the session that began the repository's history anew at
`qi-chart` 2.0.1's tree (`docs/process.md`). It says where the work stands, the next task, and what to read.

## Where the work stands

- **The history begun anew** (`docs/decisions.md`, 2026-11-08): `zhifengzhang-sz/qi-v2-visualization` on GitHub,
  public, its branch `main`: GitHub's own commit, which holds `LICENSE` (Apache 2.0), then one commit holding the tree
  of `qi-chart` 2.0.1's release with `docs/` brought up to date and the branch `main` in `agents/rules.md`. The tag
  `qi-chart-2.0.1`, annotated, its message the release's, is on that commit; `main` and that tag are all the
  repository holds. The package `qi-chart` built from the tag has the release's store path. The earlier history is
  kept by the owner, private; the documents that name a commit of it (the one tagged `qi-chart-2.0.0` among them) say
  so where a reader meets it, but for `README.md` and `dev/ts/lib/chart/README.md` (Open, below).
- **`qi-chart` 2.0.1 is released** (milestone 5), its files changed and not its code: `@qi/base` and `@qi/core` are
  `qi-v2-ts` 0.1.0's, and the README and the sources' comments name no private project. The version is 2.0.1 in
  `dev/ts/lib/chart/package.json` (and `dev/ts/bun.lock`'s workspace entry), the flake's `qi-chart`, `PRODUCTS.md`
  and the README's Changes. The chart app, the project's own tool, is not released; its package keeps 1.8.0.
- **Nothing private taken or named** (`docs/decisions.md`, 2026-11-08): everything the flake, the locks, the Makefile
  and the scripts read is public and read with no login, the flake's inputs over HTTPS and the results' image from
  GHCR by `crane`; no tracked file, no message of the history and none of its tag names a private project, a short
  name standing for one, or what only one holds (the search's patterns are not kept in the tree, since they name what
  they search for).
- **`@qi/base` and `@qi/core` from `qi-v2-ts`**: the flake input `qi-v2-ts` at the tag `qi-v2-ts-0.1.0` (commit
  `3c55f72`), its `qi-v2` and `kit` following this project's; `make qi-v2-ts-link` (in `make ts`) links each at
  `dev/ts/node_modules/@qi/`, to its folder in the package; the packages `qi-chart` and `chart` copy them from it,
  with smol-toml (and, for `qi-chart`, Node's types) beside them there. `dev/docs/lib.md` says how, and why neither
  the README's `node_modules/@qi` nor its Zod.
- **Checked by the role `checker`**, after the last change, in this repository, with no login (an empty
  `DOCKER_CONFIG`, no gh, no token): `make results-fetch` into an empty cache (its four files, each its sha256), `make
  verify VERIFY=--all`, `make chart-static` (its 53 hashes the same). Reviewed once by the role `reviewer` before the
  commit.
- **The locks**, by `make locks-check` with no login; none updated: `contracts` outdated (`chanlun-3.1.0` released;
  1.1.0 kept by the owner's leave on the static charts), `nixpkgs` outdated (`nixos-26.05` at `c56a87d`, through
  `qi-v2`'s lock), `results.lock` outdated (0.3.0 to 0.8.0 published; 0.2.0 kept by the same leave); `kit`, `market`,
  `qi-v2` and `qi-v2-ts` current.
- **`origin`** is the repository's SSH URL, which a push uses; it is read over HTTPS with no login, by the standing
  rule below (`git pull https://github.com/zhifengzhang-sz/qi-v2-visualization main`).
- The test data: `test/data/BTCUSDT-1m.csv` (4,000 public minutes of Binance US) and `marks.json`.
- Kept as it is: `dev/ts/package.json`'s workspace name `chanlun-dev` (renaming it changes `bun.lock`); the code's
  identifiers `lean` in `dev/ts/app/chart/src/edge/main.ts` and `dev/ts/app/chart/test/marks.test.ts` (the marks'
  decoder and its test's fixture), code, which the history's first commit does not change: the owner's to rename or
  keep.
- The owner's local file: `todo.md`.

## The next task: the owner's to set

None is set. What the record holds for it: the Open entry of `docs/decisions.md` (CI); the standing rules below for
`agents/rules.md`; the licence in the package's own files at its next release (milestone 5, Left); what 2.0.0 leaves
(`docs/designs/design-chart-online-2026-11-08.md`, What 2.0.0 holds, and what is left). Read `docs/decisions.md` and
`docs/milestones.md` first.

## Standing rules learnt (until the owner approves them for `agents/rules.md`)

- **No credential of the owner's is used without asking first**, whatever the reason, GitHub's rate limit included:
  gh's token, a registry login (`crane auth login`), a token passed to `nix` through `NIX_CONFIG` or the environment,
  the GitHub tools of an MCP server, an SSH key for anything but a push the brief allows (a `git fetch` or `git
  ls-remote` of `origin` uses it too: GitHub's public repositories are read over HTTPS instead). GHCR is read with no
  login: `crane` with `DOCKER_CONFIG` an empty folder of its own, so that a stored login is not used; so `make
  results-fetch` and `make locks-check` run only that way. Why: a credential acts as its owner, and what is done in
  the owner's name is the owner's to decide.
- **No private project is taken or named**: what the project takes is public and read with no login; no tracked file
  names a private project, a short name standing for one, or what only one holds (`docs/decisions.md`, 2026-11-08).
- **What a project takes from another conforms to the contracts of `qi-v2-contracts`**: they are how the projects
  communicate with each other (`docs/decisions.md`, 2026-11-08).
- **Every part takes the newest version of each product it takes**; an older one only by the owner's leave. Why: an
  upgrade updates the whole system (`docs/decisions.md`, 2026-11-08).

## Open, for the owner

- The standing rules above, for `agents/rules.md`.
- In `docs/decisions.md`, Open: CI.
- `README.md` (its first paragraph) and `dev/ts/lib/chart/README.md` (Changes, 2.0.0) name the tag `qi-chart-2.0.0`,
  which this repository does not hold, with no line saying it is of the earlier history: the history's first commit
  changes only `docs/` and the branch's line; the package's README at its next release.
- `agents/rules.md`'s repository line says the repository is "made ready to be public"; it is public.
