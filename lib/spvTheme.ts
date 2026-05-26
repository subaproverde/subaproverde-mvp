export type SpvTheme = "dark" | "light";

export const SPV_THEME_KEY = "spv:theme";

export function normalizeSpvTheme(value: string | null | undefined): SpvTheme {
  return value === "light" ? "light" : "dark";
}

export function readSpvTheme(): SpvTheme {
  if (typeof window === "undefined") return "dark";

  try {
    return normalizeSpvTheme(window.localStorage.getItem(SPV_THEME_KEY));
  } catch {
    return "dark";
  }
}

export function applySpvTheme(theme: SpvTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.spvTheme = theme;
}

export function saveSpvTheme(theme: SpvTheme) {
  applySpvTheme(theme);

  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SPV_THEME_KEY, theme);
    window.dispatchEvent(new CustomEvent("spv-theme-change", { detail: theme }));
  } catch {
    // Visual preference only; ignore storage failures.
  }
}
