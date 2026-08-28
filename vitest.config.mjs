import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environmentOptions: {
      jsdom: { url: "http://localhost" },
    },
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "lcov", "html"],
      include: ["lib/**/*.ts", "hooks/**/*.ts", "components/**/*.tsx", "app/**/*.tsx"],
      exclude: ["tests/**", "**/*.d.ts", "coverage/**", ".next/**"],
      thresholds: {
        // Gate léger T13: lib/ ≥60% sur lignes/statements
        // Global thresholds volontairement bas (components non couverts à 100% ok)
        statements: 60,
        lines: 60,
        branches: 55,
        functions: 55,
      },
    },
  },
});
