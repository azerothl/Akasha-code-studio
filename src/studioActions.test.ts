import { describe, expect, it } from "vitest";
import { parseStudioAction } from "./studioActions";

describe("composer actions", () => {
  it("preserves ordinary messages and file references", () => {
    const text = "Inspecte @src/game.ts puis explique /goal";
    expect(parseStudioAction(text)).toEqual({ action: null, prompt: text });
  });
  it("rejects unknown and incomplete directives without silently sending them", () => {
    expect(() => parseStudioAction("/inconnu test")).toThrow("inconnue");
    expect(() => parseStudioAction("/goal")).toThrow("Précisez");
  });
  it("recognizes multiline workflows", () => {
    expect(parseStudioAction("/debug échec\navec une trace")).toEqual({
      action: "debug",
      prompt: "échec\navec une trace",
    });
  });
});
