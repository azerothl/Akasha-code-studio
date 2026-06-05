export type ThemeId = "dark_akasha" | "dark" | "dark_nord" | "light" | "light_latte";

export const THEME_STORAGE_KEY = "akasha_theme";

export const THEME_IDS: ThemeId[] = ["dark_akasha", "dark", "dark_nord", "light", "light_latte"];

/** Labels aligned with Akasha Tauri UI (fr). */
export const THEME_LABELS: Record<ThemeId, string> = {
  dark_akasha: "Sombre Akasha",
  dark: "Sombre",
  dark_nord: "Sombre Nord",
  light: "Clair",
  light_latte: "Clair Latte",
};

const LEGACY_STUDIO_THEME: Record<string, ThemeId> = {
  dark: "dark_akasha",
  light: "light",
  "compact-dark": "dark_akasha",
};

export type ThemeLoadResult = {
  theme: ThemeId;
  /** Legacy `compact-dark` theme implied compact density. */
  forceCompactDensity?: boolean;
};

export function loadThemePrefs(): ThemeLoadResult {
  try {
    const shared = localStorage.getItem(THEME_STORAGE_KEY);
    if (shared && THEME_IDS.includes(shared as ThemeId)) {
      return { theme: shared as ThemeId };
    }

    const legacyStudio = localStorage.getItem("studio.uiTheme");
    if (legacyStudio) {
      if (THEME_IDS.includes(legacyStudio as ThemeId)) {
        return { theme: legacyStudio as ThemeId };
      }
      const mapped = LEGACY_STUDIO_THEME[legacyStudio];
      if (mapped) {
        return {
          theme: mapped,
          forceCompactDensity: legacyStudio === "compact-dark",
        };
      }
    }
  } catch {
    /* ignore */
  }
  return { theme: "dark_akasha" };
}

export function saveTheme(theme: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}
