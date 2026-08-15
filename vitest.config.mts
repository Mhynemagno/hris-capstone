import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { configDefaults } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    exclude: [...configDefaults.exclude, "supabase/functions/**/*.test.ts"],
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
