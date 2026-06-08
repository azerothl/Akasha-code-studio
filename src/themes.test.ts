import { describe, expect, it } from "vitest";
import { loadThemePrefs, THEME_IDS } from "./themes";

describe("loadThemePrefs", () => {
  it("defaults to dark_akasha", () => {
    expect(loadThemePrefs().theme).toBe("dark_akasha");
  });

  it("exports all Tauri theme ids", () => {
    expect(THEME_IDS).toEqual(["dark_akasha", "dark", "dark_nord", "light", "light_latte"]);
  });
});
