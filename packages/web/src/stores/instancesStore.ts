import { create } from "zustand";

const INSTANCES_STORAGE_KEY = "zulip-web-instances";
const CURRENT_INSTANCE_KEY = "zulip-web-current-instance";

export interface ZulipInstance {
  id: string;
  realm: string;
  email: string;
  apiKey: string;
}

interface StoredState {
  instances: ZulipInstance[];
  currentInstanceId: string | null;
}

function loadFromStorage(): StoredState {
  if (typeof window === "undefined") {
    return { instances: [], currentInstanceId: null };
  }
  try {
    const raw = window.localStorage.getItem(INSTANCES_STORAGE_KEY);
    const instances: ZulipInstance[] = raw ? JSON.parse(raw) : [];
    const currentId = window.localStorage.getItem(CURRENT_INSTANCE_KEY);
    const currentInstanceId =
      currentId && instances.some((i) => i.id === currentId) ? currentId : null;
    return {
      instances,
      currentInstanceId: currentInstanceId ?? (instances[0]?.id ?? null),
    };
  } catch {
    return { instances: [], currentInstanceId: null };
  }
}

function persist(instances: ZulipInstance[], currentInstanceId: string | null) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INSTANCES_STORAGE_KEY, JSON.stringify(instances));
  if (currentInstanceId) {
    window.localStorage.setItem(CURRENT_INSTANCE_KEY, currentInstanceId);
  } else {
    window.localStorage.removeItem(CURRENT_INSTANCE_KEY);
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

interface InstancesState extends StoredState {
  addInstance: (instance: Omit<ZulipInstance, "id">) => string;
  removeInstance: (id: string) => void;
  setCurrentInstanceId: (id: string | null) => void;
  getCurrentInstance: () => ZulipInstance | null;
}

export const useInstancesStore = create<InstancesState>((set, get) => ({
  ...loadFromStorage(),

  addInstance: (instance) => {
    const id = generateId();
    const newInstance: ZulipInstance = { ...instance, id };
    set((state) => {
      const instances = [...state.instances, newInstance];
      const currentInstanceId = state.currentInstanceId ?? id;
      persist(instances, currentInstanceId);
      return { instances, currentInstanceId };
    });
    return id;
  },

  removeInstance: (id) => {
    set((state) => {
      const instances = state.instances.filter((i) => i.id !== id);
      let currentInstanceId = state.currentInstanceId;
      if (currentInstanceId === id) {
        currentInstanceId = instances[0]?.id ?? null;
      }
      persist(instances, currentInstanceId);
      return { instances, currentInstanceId };
    });
  },

  setCurrentInstanceId: (id) => {
    set((state) => {
      if (id && !state.instances.some((i) => i.id === id)) return state;
      persist(state.instances, id);
      return { currentInstanceId: id };
    });
  },

  getCurrentInstance: () => {
    const { instances, currentInstanceId } = get();
    if (!currentInstanceId) return null;
    return instances.find((i) => i.id === currentInstanceId) ?? null;
  },
}));
