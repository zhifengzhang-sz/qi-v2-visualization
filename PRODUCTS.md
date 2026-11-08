# qi-v2-visualization: what it owns, gives and takes

## Responsibility

It owns `@qi/chart`, the 缠论 drawing library, its one product: it draws what its caller gives it, records that
conform to the contracts `market` and `chanlun`, K-lines and, beside them, a run of their structure, as pages by two
browser engines and as a TikZ picture, whole or one K-line at a time, and computes no structure. The chart app is the
project's own tool, not a product: it draws a run of bars with `@qi/chart`, and a run of 缠论's contract given beside
them, and knows nothing of what made them; the flake package `chart` is that tool's build. The contracts, the
libraries `@qi/base` and `@qi/core` and the shared tooling are taken, not owned.

## Products

| Product | What | Form | Version | Release | Doc |
|---|---|---|---|---|---|
| `qi-chart` | `@qi/chart` as source, with what it takes, for Bun or TypeScript | flake package | 3.0.0 | the tag `qi-chart-3.0.0` | `dev/ts/lib/chart/README.md` |

## Takes

| Product | From | Pinned by |
|---|---|---|
| `qi-v2` | `qi-v2-nix` | `flake.lock` |
| `nixpkgs` | `qi-v2`, which it follows | `flake.lock` |
| `kit` | `qi-v2-nix` | `flake.lock` |
| `contracts` | `qi-v2-contracts` | `flake.lock` |
| `market` | `qi-v2-contracts` | `flake.lock` |
| `qi-v2-ts` | `qi-v2-ts` | `flake.lock` |
