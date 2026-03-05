import { create } from "zustand";

const SIDEBAR_CONFIG_STORAGE_KEY = "zulip-web-sidebar-config";

interface SidebarConfig {
  activityOpen: boolean;
  // расширяемые поля:
  // expandedStreamSlug?: string | null;
}

const DEFAULT_CONFIG: SidebarConfig = {
  activityOpen: true,
};

function loadConfig(): SidebarConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(SIDEBAR_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<SidebarConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: SidebarConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SIDEBAR_CONFIG_STORAGE_KEY,
      JSON.stringify(config)
    );
  } catch {
    // ignore
  }
}

interface SidebarConfigState extends SidebarConfig {
  setActivityOpen: (open: boolean) => void;
  setConfig: (patch: Partial<SidebarConfig>) => void;
}

export const useSidebarConfigStore = create<SidebarConfigState>((set) => ({
  ...loadConfig(),

  setActivityOpen: (activityOpen) =>
    set((state) => {
      const next = { ...state, activityOpen };
      saveConfig(next);
      return next;
    }),

  setConfig: (patch) =>
    set((state) => {
      const next = { ...state, ...patch };
      saveConfig(next);
      return next;
    }),
}));
