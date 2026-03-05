export type TopicWithLast = { subject: string; lastMessage?: string; time?: string; badge?: number };

export type SidebarChat =
  | { type: "stream"; stream_id: number; name: string; lastMessage?: string; time?: string; topics?: TopicWithLast[]; badge?: number }
  | {
      type: "dm";
      id: number;
      name: string;
      /** Slug для URL: id-nick (1-1) или id1-nick1,id2-nick2 (группа) */
      slug: string;
      isGroup?: boolean;
      lastMessage?: string;
      time?: string;
      badge?: number;
      pinned?: boolean;
      /** Для группового ЛС — массив user_id участников (для API narrow). Для 1-on-1 не задаётся. */
      userIds?: number[];
      /** Относительный путь аватарки собеседника (только для личных чатов). Базовый URL — домен инстанса. */
      avatar_url?: string;
      /** Timestamp последнего сообщения (для сортировки по дате). */
      ts?: number;
    };

export interface SidebarProps {
  streams: { stream_id: number; name: string; lastMessage?: string; time?: string; topics?: TopicWithLast[] }[];
  selectedFolderId: string;
  /** Slug канала из URL для подсветки: "5-general" */
  activeStreamSlug?: string | null;
  activeTopic?: string | null;
  /** Slug ЛС из URL для подсветки: "422-vasya" */
  activeDmIdParam?: string | null;
  /** Личные чаты (из последних сообщений). Если не переданы, используются моки. */
  sidebarDms?: Extract<SidebarChat, { type: "dm" }>[];
  /** Единый список чатов и каналов, отсортированный по дате последнего сообщения (приоритет над streams + sidebarDms). */
  sidebarChats?: SidebarChat[];
  onSelectStream: (slug?: string) => void;
  onSelectDm?: (slug: string | null) => void;
}
