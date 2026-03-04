import type { SidebarChat } from "./types";

/** Избранное — home, Отмеченные — marker, Упоминания — alternate_email, Реакции — mood, Черновики — drafts. iconBg — цвет фона иконки (например "#58A7F720"). */
export const MY_ACTIVITY = [
  { key: "favorites", label: "Избранное", icon: "home" as const, iconBg: "#58A7F7" },
  { key: "pinned", label: "Отмеченные сообщения", icon: "marker" as const, iconBg: "#F04C4C" },
  { key: "mentions", label: "Упоминания", badge: 4, icon: "alternate_email" as const, iconBg: "#FFCC00" },
  { key: "reactions", label: "Реакции", badge: 8, icon: "mood" as const, iconBg: "#10BA4E" },
  { key: "drafts", label: "Черновики", icon: "drafts" as const, iconBg: "#B86BEF" },
] as const;

export const TOPIC_BAR_COLORS = ["#FFEB3B", "#E91E63"];

export const MOCK_DMS: SidebarChat[] = [
  {
    type: "dm",
    id: 101,
    name: "Имя Фамилия",
    isGroup: false,
    lastMessage: "Текст последнего сообщен...",
    time: "10:13",
    pinned: true,
  },
  {
    type: "dm",
    id: 102,
    name: "Имя Фамилия",
    isGroup: false,
    lastMessage: "Текст последнего сообщен...",
    time: "10:13",
    pinned: true,
  },
  {
    type: "dm",
    id: 103,
    name: "Дарья Исакова",
    isGroup: false,
    lastMessage: "Ок, тогда в четверг",
    time: "Вчера",
  },
  {
    type: "dm",
    id: 104,
    name: "Команда проекта",
    isGroup: false,
    lastMessage: "Митинг в 15:00",
    time: "10:02",
    badge: 4,
  },
];

export const MOCK_GROUPS: SidebarChat[] = [
  {
    type: "dm",
    id: 201,
    name: "Название группового чата",
    isGroup: true,
    lastMessage: "Текст последнего сообщения",
    time: "10:13",
    badge: 458,
  },
];

export const MOCK_TOPICS = ["Тема 1", "Тема 2"];

export function getStreamChats(
  streams: { stream_id: number; name: string }[]
): SidebarChat[] {
  return streams.map((s) => ({
    type: "stream" as const,
    stream_id: s.stream_id,
    name: s.name,
  }));
}

/** Найти личный чат по id (для шторки информации о пользователе) */
export function getDmById(id: number): (typeof MOCK_DMS)[number] | undefined {
  return MOCK_DMS.find((c) => c.type === "dm" && !c.isGroup && c.id === id);
}

/** Чаты в выбранной папке: каналы + часть ЛС по папке */
export function getChatsInFolder(
  folderId: string,
  streams: { stream_id: number; name: string }[]
): SidebarChat[] {
  const streamChats = getStreamChats(streams);
  switch (folderId) {
    case "1":
      return [...streamChats, MOCK_DMS[0], MOCK_DMS[1]];
    case "2":
      return [MOCK_DMS[2], MOCK_DMS[3]];
    case "3":
      return [MOCK_DMS[0], MOCK_DMS[2]];
    default:
      return [...streamChats, ...MOCK_DMS];
  }
}
