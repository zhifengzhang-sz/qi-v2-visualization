# How the project is worked: the machine, the files, the sessions

## The machine

Nix with flakes; no login: everything the project takes is public, the flake's inputs read from GitHub over HTTPS
and the results' image from GHCR by `crane`. Then the clone, `nix develop`, `make install`, `make results-fetch`. The
shell gives every tool the targets call (`flake.nix`). A push needs write access to the repository.

## The files, by kind

| Kind | Where | In git | Made by |
|---|---|---|---|
| the work | `dev/ts/` (the libraries and the app), `dev/docs/`, `test/data/` | yes | the sessions |
| what it owns, gives and takes | `PRODUCTS.md` | yes | the sessions, in the commit of the change it describes |
| the project's machinery | `flake.nix`, `flake.lock`, `results.lock`, `Makefile`, `dev/hooks/`, `dev/scripts/`, `.envrc` | yes | the sessions |
| the state of the work | `docs/opening.md`, `docs/milestones.md`, `docs/designs/`, `docs/research/`, `docs/decisions.md` | yes | each session, at its end |
| the rules for agents, their source | `agents/` | yes | the sessions, the owner approving |
| the rules for agents, generated | `AGENTS.md`, `CLAUDE.md`, `.claude/agents/`, `.github/agents/` | no | `make agents`, by the kit |
| the tools, the kit, `@qi/base` and `@qi/core` (`qi-v2-ts`) | `/nix/store`, pinned by `flake.lock`; `dev/agents`; `dev/ts/node_modules/@qi/` | the pins | `nix develop`, `make install`, `make ts` |
| the results | `.cache/results/<tag>/`, pinned by `results.lock` | the pin | `make results-fetch` |
| build output and reports | `dev/ts/**/node_modules/`, `.reports/` (the charts, the engines' scripts) | no | the targets |
| the owner's notes | `todo.md` | no | the owner |

## Where each rule lives

| Rules | Home |
|---|---|
| the standing rules, for every agent and the session | `agents/rules.md` (its generated copy `AGENTS.md`) |
| each role's | `agents/roles/<role>.md` |
| the code's style | `dev/ts/STYLE.md` |
| the libraries | `dev/docs/lib.md` |
| the chart: its versions, its components, its engines | `docs/designs/` |
| the decisions | `docs/decisions.md` |
| rules the owner gives in a session | the opening's Standing rules learnt, until approved for `agents/rules.md` |

## A session

1. **Start.** `git pull`; `nix develop`; after a change of `flake.lock` or `agents/`, `make install`; after a change
   of `results.lock`, `make results-fetch`. Then `make locks-check`: each outdated lock reported to the owner with
   what updates it, none updated without the owner's say.
2. **Work.** The opening's one task. Before the first build of the session, the owner is asked. Checks run in the
   role `checker` (`make ts`, `chart-check`, `chart-package`, `qi-chart-package`, `products-check`). No fallbacks.
3. **End.** `docs/opening.md` rewritten for the next session, `docs/milestones.md` brought up to date; committed by
   explicit paths after the checks pass, and pushed.
