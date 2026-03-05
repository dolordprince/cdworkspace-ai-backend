/**
 * API-клиент для workspace API (отдельный URL).
 * Базовый URL: VITE_WORKSPACE_API_ORIGIN + /api/v1. Запросы идут с токеном авторизации (Basic).
 * В dev запросы идут через Vite-прокси /workspace-api -> VITE_WORKSPACE_API_ORIGIN (обход CORS).
 */
import { Buffer } from "buffer";
import { useInstancesStore } from "../../stores/instancesStore";

const WORKSPACE_API_ORIGIN = (import.meta.env.VITE_WORKSPACE_API_ORIGIN ?? "").replace(/\/+$/, "");

const WORKSPACE_API_BASE =
  import.meta.env.VITE_WORKSPACE_API_BASE_URL ??
  (import.meta.env.DEV
    ? "/workspace-api/api/v1"
    : `${WORKSPACE_API_ORIGIN}/api/v1`);

function getBaseUrl(): string {
  return (WORKSPACE_API_BASE as string).replace(/\/+$/, "");
}

function getAuthHeader(): Record<string, string> {
  const instance = useInstancesStore.getState().getCurrentInstance();
  if (!instance?.apiKey) return {};
  const auth = Buffer.from(`${instance.email}:${instance.apiKey}`).toString("base64");
  return { Authorization: `Basic ${auth}` };
}

type WorkspaceFolderSystemType = "created" | "all";

interface WorkspaceFolder {
  uuid: string;
  created_at: string;
  updated_at: string;
  title: string;
  background_color_value: number;
  unread_messages: unknown[];
  system_type: WorkspaceFolderSystemType;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}/${path.replace(/^\//, "")}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Workspace API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** Список папок workspace */
export async function getFolders(): Promise<WorkspaceFolder[]> {
  const data = await request<WorkspaceFolder[]>("folders/");
  return Array.isArray(data) ? data : [];
}

/** Формат папки для UI (FolderRail): id, label, badge */
export interface WorkspaceFolderForRail {
  id: string;
  label: string;
  badge?: number;
}

export function mapWorkspaceFoldersToRail(folders: WorkspaceFolder[]): WorkspaceFolderForRail[] {
  return folders.map((f) => ({
    id: f.uuid,
    label: f.title,
    badge: f.unread_messages.length > 0 ? f.unread_messages.length : undefined,
  }));
}
