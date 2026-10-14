import { defineConfig } from "vitest/config";

/** Recette opt-in : daemon réel + modèle. Voir integration/daemon-task-recipe.test.ts. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["integration/daemon-task-recipe.test.ts"],
    env: { CODE_STUDIO_E2E_TASK: "1" },
    testTimeout: 180_000,
    hookTimeout: 20_000,
    sequence: { concurrent: false },
  },
});
