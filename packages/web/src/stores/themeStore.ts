import { create } from "zustand";

type ThemeId = "dark" | "light";

interface ThemeState {
  themeId: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const THEME_STORAGE_KEY = "zulip-web-theme";

const getInitialTheme = (): ThemeId => {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as
    | ThemeId
    | null;
  return stored ?? "dark";
};

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: getInitialTheme(),
  setTheme: (theme) =>
    set(() => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
        document.documentElement.dataset.theme = theme;
      }
      return { themeId: theme };
    }),
}));

