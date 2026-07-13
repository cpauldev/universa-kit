export type Theme = "light" | "dark";

const DEFAULT_THEME: Theme = "light";
const THEME_STORAGE_KEY = "theme";
const THEME_SWITCH_ATTR = "data-theme-switching";

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

function getRootElement(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.documentElement;
}

function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStoredTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage write failures (private mode, disabled storage, etc.).
  }
}

function withThemeTransitionsDisabled(
  root: HTMLElement,
  apply: () => void,
): void {
  root.setAttribute(THEME_SWITCH_ATTR, "true");
  apply();

  if (
    typeof window === "undefined" ||
    typeof window.requestAnimationFrame !== "function"
  ) {
    root.removeAttribute(THEME_SWITCH_ATTR);
    return;
  }

  const clearTransitions = () => {
    root.removeAttribute(THEME_SWITCH_ATTR);
  };
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(clearTransitions);
  });
}

export function getInitialTheme(): Theme {
  return readStoredTheme() ?? DEFAULT_THEME;
}

export function applyTheme(theme: Theme): void {
  const root = getRootElement();
  if (root) {
    withThemeTransitionsDisabled(root, () => {
      root.classList.toggle("dark", theme === "dark");
    });
  }
  writeStoredTheme(theme);
}

export function toggleTheme(current: Theme): Theme {
  return current === "dark" ? "light" : "dark";
}
