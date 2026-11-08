/// <reference types="node" />
// The chart app's settings, every value: `settings.ts FILE` reads the settings file (settings.ts), puts it over the
// defaults, the library's among them, and writes every value as TOML on stdout, in the file's form, so a file can be
// made from it (make chart-settings). A fault stops it, its message on stderr and exit 1.

import { error, pipe, type QiError, result, task } from "@qi/base";
import { config } from "@qi/core";
import { everyValue, resolved, settingsSchema } from "../index.ts";

const path = process.argv[2] ?? "";

const main = pipe(
  config.load(settingsSchema)(path),
  task.flatMapResult(resolved),
  task.flatMapResult((r) => config.toText(everyValue(r))),
  task.flatMap((text) =>
    task.tryPromise(error.fromUnknown("SYSTEM"))(() => Promise.resolve(console.log(text))),
  ),
);

task.run(main).then(
  result.match(
    () => undefined,
    (e: QiError) => {
      console.error(`chart-settings: ${path}: ${error.show(e)}`);
      process.exit(1);
    },
  ),
);
