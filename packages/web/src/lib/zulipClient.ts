/**
 * Клиент Zulip API через zulip-js.
 * Использует текущий выбранный инстанс из instancesStore; кэш клиента по instanceId.
 */
import { Buffer } from "buffer";

if (typeof (globalThis as unknown as { Buffer?: unknown }).Buffer === "undefined") {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

import zulipInitDefault from "zulip-js";
import { useInstancesStore } from "../stores/instancesStore";

const zulipInit = (zulipInitDefault as unknown as (config: {
  realm: string;
  username: string;
  apiKey: string;
}) => Promise<{
  streams: {
    retrieve: (params?: Record<string, unknown>) => Promise<{ streams?: { stream_id: number; name: string; description?: string }[] }>;
    topics: { retrieve: (params: { stream_id: number }) => Promise<{ topics?: { name: string }[] }> };
  };
  messages: {
    retrieve: (params: {
      narrow?: { operator: string; operand: string | number | number[] }[];
      anchor?: string | number;
      num_before?: number;
      num_after?: number;
    }) => Promise<{
      messages?: Array<{
        id: number;
        sender_id: number;
        sender_full_name?: string;
        content: string;
        timestamp: number;
        display_recipient?: string;
        subject?: string;
        type?: string;
        stream_id?: number | null;
      }>;
    }>;
    send: (params: { type: string; to: string | number[]; topic?: string; content: string }) => Promise<{ id?: number }>;
  };
}>);

type ZulipClient = Awaited<ReturnType<typeof zulipInit>>;

let clientCache: { instanceId: string; promise: Promise<ZulipClient> } | null = null;

function getClient(): Promise<ZulipClient> {
  const instance = useInstancesStore.getState().getCurrentInstance();
  if (!instance) {
    return Promise.reject(new Error("Нет выбранного инстанса Zulip"));
  }
  if (clientCache?.instanceId === instance.id) {
    return clientCache.promise;
  }
  const realm = instance.realm.replace(/\/api\/v1$/, "").replace(/\/+$/, "") || instance.realm;
  const promise = zulipInit({
    realm,
    username: instance.email,
    apiKey: instance.apiKey,
  });
  clientCache = { instanceId: instance.id, promise };
  return promise;
}

function getApiBaseUrl(): string {
  const instance = useInstancesStore.getState().getCurrentInstance();
  if (!instance) return "";
  const realm = instance.realm.replace(/\/api\/v1$/, "").replace(/\/+$/, "") || instance.realm;
  return `${realm}/api/v1`;
}

/** Базовый URL инстанса Zulip (без /api/v1) — для сборки абсолютных путей, например avatar_url. */
export function getRealmBaseUrl(): string {
  const instance = useInstancesStore.getState().getCurrentInstance();
  if (!instance) return "";
  return instance.realm.replace(/\/api\/v1$/, "").replace(/\/+$/, "") || instance.realm;
}

// --- Вход и данные о себе через Zulip API ---

export class ZulipAuthError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = "ZulipAuthError";
  }
}

interface FetchApiKeyResult {
  api_key: string;
  email: string;
  user_id: number;
}

function normalizeRealm(realm: string): string {
  let r = realm.trim().replace(/\/+$/, "");
  if (r.endsWith("/api/v1")) {
    r = r.slice(0, -"/api/v1".length);
  } else if (r.endsWith("/api")) {
    r = r.slice(0, -"/api".length);
  }
  return r;
}

/**
 * Запрашивает API key и данные о себе у сервера Zulip (fetch_api_key).
 * Используется при входе; пароль не сохраняется.
 * @throws ZulipAuthError при ошибке авторизации или сети
 */
export async function fetchApiKey(
  realm: string,
  username: string,
  password: string
): Promise<FetchApiKeyResult> {
  const base = normalizeRealm(realm);
  const url = `${base}/api/v1/fetch_api_key`;
  const body = new URLSearchParams({
    username: username.trim(),
    password,
  }).toString();

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Сетевая ошибка";
    throw new ZulipAuthError(`Не удалось подключиться к серверу: ${message}`);
  }

  let data: { result?: string; msg?: string; code?: string; api_key?: string; email?: string; user_id?: number };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new ZulipAuthError("Неверный ответ сервера");
  }

  if (data.result === "success" && data.api_key && data.email != null) {
    return {
      api_key: data.api_key,
      email: data.email,
      user_id: data.user_id ?? 0,
    };
  }

  const msg = data.msg ?? (res.ok ? "Неизвестная ошибка" : `Ошибка ${res.status}`);
  throw new ZulipAuthError(msg || "Неверный логин или пароль", data.code, data);
}

/** Авторизованный fetch к Zulip API (Basic auth: email:apiKey) */
async function zulipFetch(path: string, params?: Record<string, string>): Promise<Response> {
  const instance = useInstancesStore.getState().getCurrentInstance();
  if (!instance) throw new Error("Нет выбранного инстанса Zulip");
  const base = getApiBaseUrl();
  const url = new URL(path, base);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const auth = Buffer.from(`${instance.email}:${instance.apiKey}`).toString("base64");
  return fetch(url.toString(), {
    headers: { Authorization: `Basic ${auth}` },
  });
}

/** POST к Zulip API (Basic auth), body — application/x-www-form-urlencoded. */
async function zulipPost(path: string, body: Record<string, string>): Promise<Response> {
  const instance = useInstancesStore.getState().getCurrentInstance();
  if (!instance) throw new Error("Нет выбранного инстанса Zulip");
  const base = getApiBaseUrl();
  // Не используем new URL(path, base): относительный path резолвится и заменяет /api/v1 на path → теряется v1
  const url = `${base.replace(/\/+$/, "")}/${path.replace(/^\//, "")}`;
  const auth = Buffer.from(`${instance.email}:${instance.apiKey}`).toString("base64");
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
}

/** PATCH к Zulip API (Basic auth), body — application/x-www-form-urlencoded. */
async function zulipPatch(path: string, body: Record<string, string>): Promise<Response> {
  const instance = useInstancesStore.getState().getCurrentInstance();
  if (!instance) throw new Error("Нет выбранного инстанса Zulip");
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/+$/, "")}/${path.replace(/^\//, "")}`;
  const auth = Buffer.from(`${instance.email}:${instance.apiKey}`).toString("base64");
  return fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
}

/** DELETE к Zulip API (Basic auth). */
async function zulipDelete(path: string, body?: Record<string, string>): Promise<Response> {
  const instance = useInstancesStore.getState().getCurrentInstance();
  if (!instance) throw new Error("Нет выбранного инстанса Zulip");
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/+$/, "")}/${path.replace(/^\//, "")}`;
  const auth = Buffer.from(`${instance.email}:${instance.apiKey}`).toString("base64");
  return fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Basic ${auth}`,
      ...(body && Object.keys(body).length > 0
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    ...(body && Object.keys(body).length > 0 ? { body: new URLSearchParams(body).toString() } : {}),
  });
}

// --- Real-Time Events API (register + get-events) ---

export interface RegisterQueueResult {
  queue_id: string;
  last_event_id: number;
  event_queue_longpoll_timeout_seconds?: number;
}

export interface ZulipEvent {
  id: number;
  type: string;
  [key: string]: unknown;
}

export interface GetEventsResult {
  result?: string;
  msg?: string;
  code?: string;
  events?: ZulipEvent[];
  queue_id?: string;
}

/**
 * Регистрация очереди событий (POST /api/v1/register).
 * Возвращает queue_id и last_event_id для последующего long-poll GET /events.
 */
export async function registerQueue(eventTypes: string[]): Promise<RegisterQueueResult> {
  const body: Record<string, string> = {
    event_types: JSON.stringify(eventTypes),
  };
  const res = await zulipPost("register", body);
  const data = (await res.json()) as {
    result?: string;
    msg?: string;
    code?: string;
    queue_id?: string;
    last_event_id?: number;
    event_queue_longpoll_timeout_seconds?: number;
  };
  if (data.result === "error") {
    throw new Error(data.msg ?? data.code ?? "Ошибка регистрации очереди");
  }
  if (data.queue_id == null || data.last_event_id == null) {
    throw new Error("Некорректный ответ register: нет queue_id или last_event_id");
  }
  return {
    queue_id: data.queue_id,
    last_event_id: data.last_event_id,
    event_queue_longpoll_timeout_seconds: data.event_queue_longpoll_timeout_seconds,
  };
}

/**
 * Long-poll получение событий (GET /api/v1/events).
 * Поддерживает таймаут и AbortSignal для отмены при смене инстанса.
 */
export async function getEvents(
  queueId: string,
  lastEventId: number,
  options?: { timeoutSec?: number; signal?: AbortSignal }
): Promise<GetEventsResult> {
  const instance = useInstancesStore.getState().getCurrentInstance();
  if (!instance) throw new Error("Нет выбранного инстанса Zulip");
  const base = getApiBaseUrl();
  const url = new URL(`${base.replace(/\/+$/, "")}/events`);
  url.searchParams.set("queue_id", queueId);
  url.searchParams.set("last_event_id", String(lastEventId));
  const auth = Buffer.from(`${instance.email}:${instance.apiKey}`).toString("base64");

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (options?.timeoutSec != null && options.timeoutSec > 0) {
    timeoutId = setTimeout(() => controller.abort(), options.timeoutSec * 1000);
  }
  if (options?.signal) {
    options.signal.addEventListener("abort", () => {
      if (timeoutId != null) clearTimeout(timeoutId);
      controller.abort();
    });
  }
  const signal = controller.signal;

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Basic ${auth}` },
      signal,
    });
    if (timeoutId != null) clearTimeout(timeoutId);
    const data = (await res.json()) as GetEventsResult;
    return data;
  } catch (e) {
    if (timeoutId != null) clearTimeout(timeoutId);
    throw e;
  }
}

export interface ZulipCurrentUser {
  user_id: number;
  full_name: string;
  email: string;
}

/**
 * Пометить сообщения как прочитанные (POST /api/v1/messages/flags).
 * Вызывать при открытии чата для загруженных сообщений.
 */
export async function markMessagesAsRead(messageIds: number[]): Promise<void> {
  if (messageIds.length === 0) return;
  await zulipPost("messages/flags", {
    messages: JSON.stringify(messageIds),
    op: "add",
    flag: "read",
  });
}

export async function getCurrentUser(): Promise<ZulipCurrentUser | null> {
  try {
    const res = await zulipFetch("v1/users/me");
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string; user_id?: number; full_name?: string; email?: string };
    if (data.result === "error" || data.user_id == null) return null;
    return {
      user_id: data.user_id,
      full_name: data.full_name ?? "",
      email: data.email ?? "",
    };
  } catch {
    return null;
  }
}

/** Карта user_id → относительный путь avatar_url для подстановки аватарок в списке чатов. */
export type AvatarUrlByUserId = Map<number, string>;

/** Элемент из GET /users (members). */
export interface ZulipUserMember {
  user_id: number;
  full_name?: string;
  email?: string;
  avatar_url?: string | null;
}

/**
 * Загружает полный список пользователей (GET /users) и возвращает массив для записи в usersStore.
 */
export async function fetchUsers(): Promise<ZulipUserMember[]> {
  try {
    const res = await zulipFetch("v1/users", { client_gravatar: "false" });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      result?: string;
      members?: ZulipUserMember[];
      users?: ZulipUserMember[];
    };
    if (data.result === "error") return [];
    return Array.isArray(data.members) ? data.members : Array.isArray(data.users) ? data.users : [];
  } catch {
    return [];
  }
}

/**
 * Загружает одного пользователя (GET /users/{user_id}). Для правой панели ЛС и подгрузки профиля.
 */
export async function fetchUser(userId: number): Promise<ZulipUserMember | null> {
  try {
    const res = await zulipFetch(`v1/users/${userId}`, { client_gravatar: "false" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: string;
      user?: ZulipUserMember;
    };
    if (data.result === "error" || !data.user?.user_id) return null;
    return data.user;
  } catch {
    return null;
  }
}

/** Ответ GET /api/v1/realm/presence: presence по email. */
export interface RealmPresenceEntry {
  aggregated?: { status: string; timestamp: number };
  website?: { status: string; timestamp: number };
}

export interface RealmPresenceResponse {
  result?: string;
  presences?: Record<string, RealmPresenceEntry>;
  server_timestamp?: number;
}

/**
 * Загружает presence всех пользователей (GET /api/v1/realm/presence).
 * Ключи в presences — email пользователя; status: "active" | "idle", timestamp — Unix time.
 */
export async function fetchRealmPresence(): Promise<RealmPresenceResponse> {
  try {
    const res = await zulipFetch("v1/realm/presence");
    if (!res.ok) return { result: "error" };
    const data = (await res.json()) as RealmPresenceResponse;
    return data;
  } catch {
    return { result: "error" };
  }
}

/**
 * Загружает список пользователей и возвращает карту user_id → avatar_url (относительный путь).
 * В сообщениях Zulip обычно нет avatar_url в display_recipient, поэтому аватарки берём из GET /users.
 * Предпочтительно использовать fetchUsers() + usersStore.mergeUsers() и usersStore.getAvatarMap().
 */
export async function fetchUsersAvatarMap(): Promise<AvatarUrlByUserId> {
  const list = await fetchUsers();
  const map = new Map<number, string>();
  for (const u of list) {
    if (u.user_id != null && u.avatar_url != null && String(u.avatar_url).trim() !== "") {
      map.set(u.user_id, String(u.avatar_url).trim());
    }
  }
  return map;
}

/** Одна реакция на сообщение (Zulip API). */
export interface Reaction {
  emoji_name: string;
  emoji_code: string;
  reaction_type: "unicode_emoji" | "realm_emoji" | "zulip_extra_emoji";
  user_id: number;
}

/** Сырое сообщение из GET /messages (для stream и private). flags: например 'read', 'mentioned' — нет 'read' = непрочитано. */
export interface ZulipRawMessage {
  id: number;
  sender_id: number;
  sender_full_name?: string;
  /** Аватар отправителя (относительный путь). Есть в ответе GET /messages. */
  avatar_url?: string | null;
  content: string;
  timestamp: number;
  display_recipient?: string | Array<{ id: number; full_name: string; email?: string; avatar_url?: string }>;
  subject?: string;
  type?: string;
  stream_id?: number | null;
  flags?: string[];
  reactions?: Reaction[];
}

/**
 * Загружает последние 1000 сообщений (без narrow) для формирования списка чатов/каналов в сайдбаре.
 * Параметры как в запросе: anchor=newest&num_before=1000&num_after=0&client_gravatar=true&allow_empty_topic_name=true
 */
export async function fetchRecentMessages(): Promise<ZulipRawMessage[]> {
  const res = await zulipFetch("/api/v1/messages", {
    anchor: "newest",
    num_before: "1000",
    num_after: "0",
    client_gravatar: "true",
    allow_empty_topic_name: "true",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { result?: string; messages?: ZulipRawMessage[] };
  if (data.result === "error") return [];
  return data.messages ?? [];
}

export type ActivityFilter = "starred" | "mentions" | "reactions";

type NarrowEntry = { negated?: boolean; operator: string; operand: string | number };

function getActivityNarrow(filter: ActivityFilter, currentUserId?: number | null): NarrowEntry[] {
  switch (filter) {
    case "starred":
      return [{ negated: false, operator: "is", operand: "starred" }];
    case "mentions":
      return [{ negated: false, operator: "is", operand: "mentioned" }];
    case "reactions":
      return currentUserId != null
        ? [
            { negated: false, operator: "has", operand: "reaction" },
            { negated: false, operator: "sender", operand: currentUserId },
          ]
        : [{ negated: false, operator: "has", operand: "reaction" }];
    default:
      return [];
  }
}

/**
 * Загружает сообщения для раздела «Моя активность» по narrow (избранное, упоминания, реакции).
 * Для реакций в narrow добавляется sender с currentUserId, если он передан.
 */
export async function fetchActivityMessages(
  filter: ActivityFilter,
  currentUserId?: number | null
): Promise<ZulipRawMessage[]> {
  const narrow = getActivityNarrow(filter, currentUserId);
  const res = await zulipFetch("/api/v1/messages", {
    anchor: "newest",
    num_before: "200",
    num_after: "0",
    narrow: JSON.stringify(narrow),
    allow_empty_topic_name: "true",
    client_gravatar: "true",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { result?: string; messages?: ZulipRawMessage[] };
  if (data.result === "error") return [];
  return data.messages ?? [];
}

export interface MockStream {
  stream_id: number;
  name: string;
  description: string;
  is_announcement_only: boolean;
}

export interface MockFolder {
  id: string;
  label: string;
  badge?: number;
}

export async function fetchFolders(): Promise<MockFolder[]> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return [];
  const res = await fetch(`${apiBaseUrl}/folders`);
  if (!res.ok) return [];
  const data = (await res.json()) as { folders?: MockFolder[] };
  return data.folders ?? [];
}

export interface MockMessage {
  id: number;
  sender_id: number;
  sender_full_name: string;
  stream_id: number | null;
  channel?: string;
  subject: string;
  content: string;
  timestamp: number;
  /** Флаги из API (например 'read', 'mentioned'). Нет 'read' — сообщение непрочитано. */
  flags?: string[];
  reactions?: Reaction[];
}

export function rawMessageToMockMessage(m: {
  id: number;
  sender_id: number;
  sender_full_name?: string;
  content: string;
  timestamp: number;
  display_recipient?: string | Array<{ id: number }>;
  subject?: string;
  type?: string;
  stream_id?: number | null;
  flags?: string[];
  reactions?: Reaction[];
}): MockMessage {
  return {
    id: m.id,
    sender_id: m.sender_id,
    sender_full_name: m.sender_full_name ?? "",
    stream_id: m.stream_id ?? (m.type === "private" ? null : m.stream_id ?? null),
    channel: typeof m.display_recipient === "string" ? m.display_recipient : undefined,
    subject: m.subject ?? "",
    content: m.content,
    timestamp: m.timestamp,
    flags: m.flags,
    reactions: m.reactions,
  };
}

function mapZulipMessage(m: Parameters<typeof rawMessageToMockMessage>[0]): MockMessage {
  return rawMessageToMockMessage(m);
}

export async function fetchStreams(): Promise<MockStream[]> {
  const client = await getClient();
  const data = await client.streams.retrieve();
  const list = data.streams ?? [];
  return list.map((s) => ({
    stream_id: s.stream_id,
    name: s.name,
    description: s.description ?? "",
    is_announcement_only: false,
  }));
}

export async function fetchMessages(
  stream?: string,
  topic?: string,
  q?: string
): Promise<MockMessage[]> {
  const client = await getClient();
  const narrow: { operator: string; operand: string }[] = [];
  if (stream) narrow.push({ operator: "stream", operand: stream });
  if (topic) narrow.push({ operator: "topic", operand: topic });
  if (q?.trim()) narrow.push({ operator: "search", operand: q.trim() });
  try {
    const data = await client.messages.retrieve({
      narrow: narrow.length ? narrow : undefined,
      anchor: "newest",
      num_before: 100,
      num_after: 0,
    }) as { result?: string; messages?: Parameters<typeof mapZulipMessage>[0][] };
    if (data.result === "error") return [];
    const list = data.messages ?? [];
    return list.map(mapZulipMessage);
  } catch {
    return [];
  }
}

/** Формат narrow для dm в Zulip: operand — массив user_id участников, например [427]. */
type DmNarrow = { negated: false; operator: "dm"; operand: number[] };

/** Синтетический id группового ЛС в сайдбаре (не user_id). В API не подставлять. */
const GROUP_DM_ID_OFFSET = 2_000_000;

/**
 * Загружает сообщения личного чата (1-on-1 или группа).
 * @param userIds — массив user_id участников (для 1-on-1 передайте [userId] второго пользователя).
 */
export async function fetchDmMessages(userIds: number | number[]): Promise<MockMessage[]> {
  const client = await getClient();
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  if (ids.some((id) => id >= GROUP_DM_ID_OFFSET)) return []; // не подставлять синтетический id в API
  const params = {
    narrow: [{ negated: false, operator: "dm", operand: ids }] as DmNarrow[],
    anchor: "newest",
    num_before: 60,
    num_after: 150,
    client_gravatar: true,
    allow_empty_topic_name: true,
  };
  try {
    const data = await client.messages.retrieve(
      params as Parameters<ZulipClient["messages"]["retrieve"]>[0]
    );
    const raw = data as { result?: string; messages?: Parameters<typeof mapZulipMessage>[0][] };
    if (raw.result === "error") return [];
    const list = raw.messages ?? [];
    return list.map(mapZulipMessage);
  } catch {
    return [];
  }
}

export async function fetchTopics(stream: string): Promise<string[]> {
  const client = await getClient();
  const streamsData = await client.streams.retrieve();
  const streamObj = (streamsData.streams ?? []).find((s) => s.name === stream);
  if (!streamObj) return [];
  const data = await client.streams.topics.retrieve({ stream_id: streamObj.stream_id });
  return (data.topics ?? []).map((t) => t.name);
}

export interface SendMessageParams {
  /** For stream message: stream name. Omit when using `to` for private. */
  stream?: string;
  subject?: string;
  content: string;
  sender_id?: number;
  sender_full_name?: string;
  /** For private/DM message: recipient user ids. When set, `stream` is ignored. */
  to?: number[];
}

export async function sendMessage(params: SendMessageParams): Promise<MockMessage> {
  const isPrivate = params.to != null && params.to.length > 0;
  if (!isPrivate && !params.stream) {
    throw new Error("Нужен канал (stream) или получатели (to) для отправки");
  }
  const client = await getClient();

  if (isPrivate) {
    const result = await client.messages.send({
      type: "private",
      to: params.to as number[],
      content: params.content,
    });
    const id = result.id ?? 0;
    return {
      id,
      sender_id: 999,
      sender_full_name: params.sender_full_name ?? "Вы",
      stream_id: null,
      subject: "",
      content: params.content,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  const stream = params.stream ?? "";
  const subject = params.subject ?? "general";
  const result = await client.messages.send({
    type: "stream",
    to: stream,
    topic: subject,
    content: params.content,
  });
  const id = result.id ?? 0;
  return {
    id,
    sender_id: 999,
    sender_full_name: params.sender_full_name ?? "Вы",
    stream_id: null,
    channel: stream,
    subject,
    content: params.content,
    timestamp: Math.floor(Date.now() / 1000),
  };
}

/**
 * Обновить сообщение (PATCH /api/v1/messages/{message_id}).
 * Меняет content; для смены topic/stream см. Zulip API.
 */
export async function updateMessage(
  messageId: number,
  params: { content: string }
): Promise<void> {
  const res = await zulipPatch(`messages/${messageId}`, {
    content: params.content,
  });
  if (!res.ok) {
    const data = (await res.json()) as { msg?: string };
    throw new Error(data.msg ?? `Ошибка ${res.status}`);
  }
}

/**
 * Удалить сообщение (DELETE /api/v1/messages/{message_id}).
 */
export async function deleteMessage(messageId: number): Promise<void> {
  const res = await zulipDelete(`messages/${messageId}`);
  if (!res.ok) {
    const data = (await res.json()) as { msg?: string };
    throw new Error(data.msg ?? `Ошибка ${res.status}`);
  }
}

/**
 * Добавить реакцию на сообщение (POST /api/v1/messages/{message_id}/reactions).
 */
export async function addReaction(
  messageId: number,
  emojiName: string,
  reactionType: "unicode_emoji" | "realm_emoji" | "zulip_extra_emoji" = "unicode_emoji"
): Promise<void> {
  const body: Record<string, string> = { emoji_name: emojiName, reaction_type: reactionType };
  const res = await zulipPost(`messages/${messageId}/reactions`, body);
  if (!res.ok) {
    const data = (await res.json()) as { msg?: string; code?: string };
    if (data.code === "REACTION_ALREADY_EXISTS") return;
    throw new Error(data.msg ?? `Ошибка ${res.status}`);
  }
}

/**
 * Убрать реакцию с сообщения (DELETE /api/v1/messages/{message_id}/reactions).
 */
export async function removeReaction(
  messageId: number,
  emojiName: string,
  options?: { emojiCode?: string; reactionType?: string }
): Promise<void> {
  const body: Record<string, string> = { emoji_name: emojiName };
  if (options?.emojiCode) body.emoji_code = options.emojiCode;
  if (options?.reactionType) body.reaction_type = options.reactionType;
  const res = await zulipDelete(`messages/${messageId}/reactions`, body);
  if (!res.ok) {
    const data = (await res.json()) as { msg?: string };
    throw new Error(data.msg ?? `Ошибка ${res.status}`);
  }
}

/**
 * Добавить или убрать флаг у сообщений (POST /api/v1/messages/flags).
 * flag: "read" | "starred" | "mentioned" и др.
 */
export async function updateMessageFlags(
  messageIds: number[],
  op: "add" | "remove",
  flag: string
): Promise<void> {
  if (messageIds.length === 0) return;
  await zulipPost("messages/flags", {
    messages: JSON.stringify(messageIds),
    op,
    flag,
  });
}

/** Пометить сообщения как в избранном (starred). */
export async function addMessageFlag(messageIds: number[], flag: string): Promise<void> {
  await updateMessageFlags(messageIds, "add", flag);
}

/** Убрать флаг у сообщений (например снять звезду). */
export async function removeMessageFlag(messageIds: number[], flag: string): Promise<void> {
  await updateMessageFlags(messageIds, "remove", flag);
}
