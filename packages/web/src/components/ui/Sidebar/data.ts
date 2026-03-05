import type { SidebarChat, TopicWithLast } from "./types";
import type { ZulipRawMessage } from "../../../lib/zulipClient";
import { useUsersStore } from "../../../stores/usersStore";

/** Избранное — home, Отмеченные — marker, Упоминания — alternate_email, Реакции — mood, Черновики — drafts. iconBg — цвет фона иконки. route — для пунктов с экраном. */
export const MY_ACTIVITY = [
  { key: "favorites", label: "Избранное", icon: "home" as const, iconBg: "#58A7F7", route: "/activity/starred" as const },
  { key: "pinned", label: "Отмеченные сообщения", icon: "marker" as const, iconBg: "#F04C4C" },
  { key: "mentions", label: "Упоминания", icon: "alternate_email" as const, iconBg: "#FFCC00", route: "/activity/mentions" as const },
  { key: "reactions", label: "Реакции", icon: "mood" as const, iconBg: "#10BA4E", route: "/activity/reactions" as const },
  { key: "drafts", label: "Черновики", icon: "drafts" as const, iconBg: "#B86BEF" },
] as const;

export const TOPIC_BAR_COLORS = ["#FFEB3B", "#E91E63"];

export const MOCK_DMS: SidebarChat[] = [
  { type: "dm", id: 101, name: "user1", slug: "101-user1", isGroup: false, lastMessage: "Текст последнего сообщен...", time: "10:13", pinned: true },
  { type: "dm", id: 102, name: "user2", slug: "102-user2", isGroup: false, lastMessage: "Текст последнего сообщен...", time: "10:13", pinned: true },
  { type: "dm", id: 103, name: "user3", slug: "103-user3", isGroup: false, lastMessage: "Ок, тогда в четверг", time: "Вчера" },
  { type: "dm", id: 104, name: "team", slug: "104-team", isGroup: false, lastMessage: "Митинг в 15:00", time: "10:02", badge: 4 },
];

export const MOCK_GROUPS: SidebarChat[] = [
  { type: "dm", id: 201, name: "Групповой чат", slug: "201-group", isGroup: true, lastMessage: "Текст последнего сообщения", time: "10:13", badge: 458 },
];

const MOCK_TOPICS = ["Тема 1", "Тема 2"];

export type StreamWithLast = { stream_id: number; name: string; lastMessage?: string; time?: string; topics?: TopicWithLast[]; badge?: number };

export function getStreamChats(
  streams: StreamWithLast[]
): SidebarChat[] {
  return streams.map((s) => ({
    type: "stream" as const,
    stream_id: s.stream_id,
    name: s.name,
    lastMessage: s.lastMessage,
    time: s.time,
    topics: s.topics,
    badge: s.badge,
  }));
}

/** Найти личный чат по slug из URL или по id. Использует переданный список dms или MOCK_DMS. */
export function getDmById(
  slugOrId: number | string,
  dms?: Extract<SidebarChat, { type: "dm" }>[]
): Extract<SidebarChat, { type: "dm" }> | undefined {
  const list = (dms ?? MOCK_DMS) as Extract<SidebarChat, { type: "dm" }>[];
  if (typeof slugOrId === "string") {
    return list.find((c) => c.slug === slugOrId);
  }
  return list.find((c) => c.id === slugOrId);
}

/** Чаты в выбранной папке: только личные чаты, отсортированные по дате последнего сообщения (новые сверху). */
export function getChatsInFolder(
  _folderId: string,
  _streams: StreamWithLast[],
  dms?: Extract<SidebarChat, { type: "dm" }>[]
): SidebarChat[] {
  const dmList: Extract<SidebarChat, { type: "dm" }>[] = dms ?? (MOCK_DMS as Extract<SidebarChat, { type: "dm" }>[]);
  return [...dmList].sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
}

const MAX_PREVIEW_LEN = 60;
function truncatePreview(text: string): string {
  const plain = text.replace(/<[^>]+>/g, "").trim();
  if (plain.length <= MAX_PREVIEW_LEN) return plain;
  return plain.slice(0, MAX_PREVIEW_LEN) + "…";
}

function formatMessageTime(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (sameDay) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

/** Простой хеш строки в число (для id групповых ЛС) */
function hashKey(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % 1000000;
}

const GROUP_DM_ID_OFFSET = 2000000;

/** URL-безопасный slug: lowercase, пробелы и недопустимые символы → "-", убрать повторяющиеся "-". */
function slugify(s: string): string {
  const lower = s.trim().toLowerCase();
  const safe = lower.replace(/[^\p{L}\p{N}-]/gu, "-").replace(/-+/g, "-");
  return safe.replace(/^-|-$/g, "") || "chat";
}

/** Ник для отображения: из email локальная часть до @, иначе full_name. */
function getDisplayName(recipient: { email?: string; full_name?: string }): string {
  if (recipient.email != null && recipient.email.length > 0) {
    const part = recipient.email.split("@")[0];
    if (part) return part;
  }
  return recipient.full_name ?? "";
}

/** Имя собеседника для личного чата: только full_name (имя человека), иначе локальная часть email. */
function getDmPartnerName(recipient: { email?: string; full_name?: string }): string {
  const name = (recipient.full_name ?? "").trim();
  if (name) return name;
  return getDisplayName(recipient) || "Личный чат";
}

/** Slug для канала: stream_id-stream_name. */
export function slugForStream(stream: { stream_id: number; name: string }): string {
  return `${stream.stream_id}-${slugify(stream.name)}`;
}

/** Парсинг streamSlug из URL: "5-general" -> { stream_id: 5, stream_name: "general" }; "general" (legacy) -> { stream_name: "general" }. */
export function parseStreamSlug(streamSlug: string): { stream_id?: number; stream_name: string } {
  const firstDash = streamSlug.indexOf("-");
  if (firstDash > 0) {
    const lead = streamSlug.slice(0, firstDash);
    const num = parseInt(lead, 10);
    if (!Number.isNaN(num) && String(num) === lead) {
      const rest = streamSlug.slice(firstDash + 1);
      return { stream_id: num, stream_name: rest };
    }
  }
  return { stream_name: decodeURIComponent(streamSlug) };
}

/** Парсинг dm slug из URL в массив user_id для API: "422-vasya" -> [422], "422-vasya,507-petya" -> [422, 507]. */
export function parseDmSlugToUserIds(dmSlug: string): number[] {
  return dmSlug
    .split(",")
    .map((part) => parseInt(part.split("-")[0], 10))
    .filter((n) => !Number.isNaN(n));
}

type StreamTopicEntry = { subject: string; lastMessage: string; time: string; ts: number; unreadCount: number; lastMessageId?: number };
export type StreamEntryInternal = { stream_id: number; name: string; lastMessage: string; time: string; ts: number; topics: Map<string, StreamTopicEntry> };
export type DmEntryInternal = { id: number; name: string; slug: string; isGroup: boolean; lastMessage: string; time: string; ts: number; userIds?: number[]; unreadCount: number; avatar_url?: string; lastMessageId?: number };

export function isUnread(m: ZulipRawMessage): boolean {
  return !(m.flags && m.flags.includes("read"));
}

/** Одна запись темы из stream-сообщения (для слияния в Map). */
export function messageToStreamEntry(m: ZulipRawMessage): { stream: Omit<StreamEntryInternal, "topics"> & { topics: Map<string, StreamTopicEntry> }; topic: StreamTopicEntry } | null {
  if (m.type !== "stream" || m.stream_id == null) return null;
  const lastMsg = truncatePreview(m.content);
  const time = formatMessageTime(m.timestamp);
  const name = typeof m.display_recipient === "string" ? m.display_recipient : String(m.stream_id);
  const subject = (m.subject ?? "").trim() || "general";
  const topicEntry: StreamTopicEntry = { subject, lastMessage: lastMsg, time, ts: m.timestamp, unreadCount: isUnread(m) ? 1 : 0, lastMessageId: m.id };
  return {
    stream: { stream_id: m.stream_id, name, lastMessage: lastMsg, time, ts: m.timestamp, topics: new Map([[subject, topicEntry]]) },
    topic: topicEntry,
  };
}

/** Канонический ключ диалога: отсортированный список id всех участников. Для 1-on-1 при одном получателе добавляем currentUserId. */
export function dmConversationKey(
  display_recipient: Array<{ id: number }>,
  currentUserId: number | null
): string {
  const ids = display_recipient.map((r) => r.id);
  if (currentUserId != null && ids.length === 1 && ids[0] !== currentUserId) {
    return [currentUserId, ids[0]].sort((a, b) => a - b).join(",");
  }
  return [...ids].sort((a, b) => a - b).join(",");
}

/** Одна запись ЛС из private-сообщения. Имя и аватар по возможности из usersStore. */
export function messageToDmEntry(
  m: ZulipRawMessage,
  currentUserId: number | null,
  avatarUrlByUserId?: Map<number, string>
): DmEntryInternal | null {
  if (m.type !== "private" || !Array.isArray(m.display_recipient)) return null;
  const usersStore = useUsersStore.getState();
  const recipients = m.display_recipient
    .map((r) => ({ id: r.id, full_name: r.full_name ?? "", email: r.email ?? "", avatar_url: r.avatar_url }))
    .sort((a, b) => a.id - b.id);
  const key = recipients.map((r) => r.id).join(",");
  const otherUsers =
    currentUserId != null
      ? recipients.filter((r) => r.id !== currentUserId)
      : recipients;
  const isGroup =
    otherUsers.length !== 1 ||
    (currentUserId == null && recipients.length === 2);
  const nameFromStore = (userId: number) => usersStore.getDisplayName(userId);
  const avatarFromStore = (userId: number) =>
    usersStore.getAvatarUrl(userId) ?? avatarUrlByUserId?.get(userId);
  const name = isGroup
    ? currentUserId == null && recipients.length === 2
      ? "Личный чат"
      : otherUsers
          .map((u) => nameFromStore(u.id) || getDisplayName(u))
          .filter(Boolean)
          .join(", ") || "Групповой чат"
    : (otherUsers[0] && nameFromStore(otherUsers[0].id)) || getDmPartnerName(otherUsers[0] ?? {});
  let id: number;
  let userIds: number[] | undefined;
  let avatar_url: string | undefined;
  if (isGroup) {
    id = GROUP_DM_ID_OFFSET + hashKey(key);
    userIds = recipients.map((r) => r.id);
  } else {
    const other = otherUsers[0];
    const otherUserId = other?.id ?? (currentUserId != null ? recipients.find((r) => r.id !== currentUserId)?.id : undefined);
    if (otherUserId == null) return null;
    id = otherUserId;
    const fromMessage = m.sender_id === id && m.avatar_url ? String(m.avatar_url).trim() : undefined;
    avatar_url = avatarFromStore(id) ?? fromMessage ?? other?.avatar_url;
  }
  const slug = isGroup ? otherUsers.map((u) => `${u.id}-${slugify(nameFromStore(u.id) || getDisplayName(u))}`).join(",") : `${id}-${slugify(name)}`;
  const lastMsg = truncatePreview(m.content);
  const time = formatMessageTime(m.timestamp);
  return { id, name, slug, isGroup, lastMessage: lastMsg, time, ts: m.timestamp, userIds, unreadCount: isUnread(m) ? 1 : 0, avatar_url, lastMessageId: m.id };
}

/**
 * Строит списки каналов (streams) с темами и личных чатов (dms) с slug из последних сообщений Zulip.
 * Каналы по stream_id, темы по subject; дата последнего сообщения канала — макс по любой теме.
 * Непрочитанные: сообщения без 'read' в flags; счётчик по stream/topic и по DM.
 * avatarUrlByUserId — карта user_id → avatar_url из GET /users (в сообщениях avatar_url обычно нет).
 */
export function buildSidebarFromMessages(
  messages: ZulipRawMessage[],
  currentUserId: number | null,
  avatarUrlByUserId?: Map<number, string>
): {
  streams: StreamWithLast[];
  dms: Extract<SidebarChat, { type: "dm" }>[];
  streamsMap: Map<number, StreamEntryInternal>;
  dmsMap: Map<string, DmEntryInternal>;
} {
  const streamUnread = new Map<string, number>();
  const dmUnread = new Map<string, number>();

  for (const m of messages) {
    const unread = isUnread(m);
    if (m.type === "stream" && m.stream_id != null) {
      const subject = (m.subject ?? "").trim() || "general";
      const key = `${m.stream_id}\t${subject}`;
      streamUnread.set(key, (streamUnread.get(key) ?? 0) + (unread ? 1 : 0));
    } else if (m.type === "private" && Array.isArray(m.display_recipient)) {
      const key = dmConversationKey(m.display_recipient, currentUserId);
      dmUnread.set(key, (dmUnread.get(key) ?? 0) + (unread ? 1 : 0));
    }
  }

  const streamsByKey = new Map<number, StreamEntryInternal>();
  const dmsByKey = new Map<string, DmEntryInternal>();

  for (const m of messages) {
    const streamResult = messageToStreamEntry(m);
    if (streamResult) {
      const { stream_id, name, lastMessage, time, ts } = streamResult.stream;
      const topicEntry = streamResult.topic;
      const unreadKey = `${stream_id}\t${topicEntry.subject}`;
      const topicWithUnread: StreamTopicEntry = { ...topicEntry, unreadCount: streamUnread.get(unreadKey) ?? 0, lastMessageId: m.id };
      const existing = streamsByKey.get(stream_id);
      if (!existing) {
        const topics = new Map<string, StreamTopicEntry>();
        topics.set(topicWithUnread.subject, topicWithUnread);
        streamsByKey.set(stream_id, { stream_id, name, lastMessage, time, ts, topics });
      } else {
        const existingTopic = existing.topics.get(topicWithUnread.subject);
        const nextTopics = new Map(existing.topics);
        if (!existingTopic || topicWithUnread.ts >= existingTopic.ts) {
          nextTopics.set(topicWithUnread.subject, topicWithUnread);
        } else {
          nextTopics.set(topicWithUnread.subject, { ...existingTopic, unreadCount: topicWithUnread.unreadCount });
        }
        const newerStream = m.timestamp >= existing.ts;
        streamsByKey.set(stream_id, {
          stream_id,
          name: existing.name,
          lastMessage: newerStream ? lastMessage : existing.lastMessage,
          time: newerStream ? time : existing.time,
          ts: Math.max(existing.ts, m.timestamp),
          topics: nextTopics,
        });
      }
      continue;
    }

    if (m.type !== "private" || !Array.isArray(m.display_recipient)) continue;
    const dmEntry = messageToDmEntry(m, currentUserId, avatarUrlByUserId);
    if (dmEntry) {
      const key = dmConversationKey(m.display_recipient, currentUserId);
      const unreadCount = dmUnread.get(key) ?? 0;
      const existing = dmsByKey.get(key);
      const avatar_url = dmEntry.avatar_url ?? existing?.avatar_url;
      const entryWithUnread = { ...dmEntry, unreadCount, avatar_url, lastMessageId: m.id };
      if (!existing || dmEntry.ts >= existing.ts) {
        dmsByKey.set(key, entryWithUnread);
      } else {
        dmsByKey.set(key, { ...existing, unreadCount, avatar_url: existing.avatar_url ?? avatar_url });
      }
    }
  }

  const streams: StreamWithLast[] = Array.from(streamsByKey.values())
    .sort((a, b) => b.ts - a.ts)
    .map((s) => {
      const topics = Array.from(s.topics.values())
        .sort((a, b) => b.ts - a.ts)
        .map((t) => ({ subject: t.subject, lastMessage: t.lastMessage, time: t.time, badge: t.unreadCount > 0 ? t.unreadCount : undefined }));
      const badge = topics.reduce((sum, t) => sum + (t.badge ?? 0), 0);
      return {
        stream_id: s.stream_id,
        name: s.name,
        lastMessage: s.lastMessage,
        time: s.time,
        topics,
        badge: badge > 0 ? badge : undefined,
      };
    });
  const dms: Extract<SidebarChat, { type: "dm" }>[] = Array.from(dmsByKey.values())
    .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
    .map((x) => ({
      type: "dm" as const,
      id: x.id,
      name: x.name,
      slug: x.slug,
      isGroup: x.isGroup,
      lastMessage: x.lastMessage,
      time: x.time,
      userIds: x.userIds,
      badge: x.unreadCount > 0 ? x.unreadCount : undefined,
      avatar_url: x.avatar_url,
      ts: x.ts,
    }));

  return { streams, dms, streamsMap: streamsByKey, dmsMap: dmsByKey };
}
