import type { StudioCodeMode } from "./api";

export const CODE_MODE_OPTIONS: { value: StudioCodeMode; label: string; hint: string }[] = [
  { value: "free", label: "Libre", hint: "Aucun préfixe de mode (comportement par défaut du daemon)." },
  { value: "plan", label: "Plan", hint: "Priorité analyse et plan — pas d’implémentation sauf demande explicite." },
  {
    value: "implement",
    label: "Implémentation",
    hint: "Produire ou modifier le code dans le périmètre du plan et de la stack.",
  },
  { value: "build", label: "Build / qualité", hint: "Privilégier build, tests et corrections." },
];

const LS_CODE_MODE = "akasha-code-studio-code-mode";

export function loadPersistedCodeMode(): StudioCodeMode {
  try {
    const v = localStorage.getItem(LS_CODE_MODE);
    if (v === "plan" || v === "implement" || v === "build" || v === "free") return v;
  } catch {
    /* ignore */
  }
  return "free";
}

export function persistCodeMode(m: StudioCodeMode): void {
  try {
    localStorage.setItem(LS_CODE_MODE, m);
  } catch {
    /* ignore */
  }
}
