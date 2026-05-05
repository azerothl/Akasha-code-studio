import { defineConfig } from "vitest/config";

/** Tests contre un daemon Akasha réel (pas de mock). Voir `integration/daemon-studio.test.ts`. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["integration/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 15_000,
    sequence: { concurrent: false },
  },
});
