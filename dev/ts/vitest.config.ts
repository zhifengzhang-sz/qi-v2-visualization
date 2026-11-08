import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["lib/*/test/**/*.test.ts", "app/*/test/**/*.test.ts"] },
});
