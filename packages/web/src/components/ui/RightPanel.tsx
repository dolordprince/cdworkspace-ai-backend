import React from "react";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
import { ScrollArea } from "./ScrollArea";
import { getRealmBaseUrl } from "../../lib/zulipClient";

/** Данные пользователя для шторки информации в личном чате */
export interface RightPanelUserInfo {
  name: string;
  lastSeen?: string;
  /** Полный URL аватарки (или относительный путь — будет дополнен realm) */
  avatarUrl?: string | null;
  phone?: string;
  username?: string;
  role?: string;
  birthday?: string;
  media?: { photos?: number; videos?: number; files?: number; links?: number };
  commonGroups?: { name: string; lastMessage?: string; unread?: number }[];
}

interface RightPanelProps {
  /** Для канала: название и счётчики */
  title: string;
  participantsCount?: number;
  onlineCount?: number;
  /** Для личного чата: данные пользователя (при наличии показывается «Информация» о юзере) */
  user?: RightPanelUserInfo;
}

const CHANNEL_MEDIA_ITEMS = [
  { label: "36 фотографий", icon: "images" as const },
  { label: "5 видео", icon: "videos" as const },
  { label: "42 файла", icon: "files" as const },
  { label: "4 ссылки", icon: "links" as const },
] as const;

const CALLS = [
  { name: "Название звонка | #Тема 1", duration: "1:34:07" },
  { name: "Название звонка | #Тема 2", duration: "21:07" },
];

const PARTICIPANTS = [
  { name: "Участник", status: "Был 35 минут назад", isOwner: true },
  { name: "Участник", status: "Был 35 минут назад", isOwner: false },
  { name: "Участник", status: "Был 35 минут назад", isOwner: false },
];

const USER_ACTIONS = [
  { label: "Поделиться контактом", icon: "profile" as const },
  { label: "Изменить контакт", icon: "pen" as const },
  { label: "Удалить контакт", icon: "close" as const },
  { label: "Заблокировать", icon: "bell" as const },
] as const;

function resolveAvatarSrc(url: string | undefined | null): string | undefined {
  if (!url?.trim()) return undefined;
  const s = url.trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const base = getRealmBaseUrl();
  if (!base) return undefined;
  return `${base.replace(/\/+$/, "")}${s.startsWith("/") ? s : `/${s}`}`;
}

function RightPanelUser({ user }: { user: RightPanelUserInfo }) {
  const media = user.media ?? {};
  const photos = media.photos ?? 0;
  const videos = media.videos ?? 0;
  const files = media.files ?? 0;
  const links = media.links ?? 0;
  const contactRows = [
    user.phone && { label: "Телефон", value: user.phone, icon: "phone" as const },
    user.username && { label: "Имя пользователя", value: user.username, icon: "profile" as const },
    user.role && { label: "Роль", value: user.role, icon: "profile" as const },
    user.birthday && { label: "День рождения", value: user.birthday, icon: "calendar" as const },
  ].filter(Boolean) as { label: string; value: string; icon: "phone" | "profile" | "calendar" }[];
  const avatarSrc = resolveAvatarSrc(user.avatarUrl);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden text-white">
      <header className="flex-shrink-0 px-4 pt-0 pb-3 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white mb-3">Информация</h2>
        <div className="flex items-center gap-3">
          <Avatar size="lg" className="text-white/80 bg-white/20" src={avatarSrc ?? undefined}>
            {user.name.slice(0, 1)}
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            {user.lastSeen && (
              <p className="text-[11px] text-white/70">
                {user.lastSeen === "онлайн"
                  ? "В сети"
                  : `был(а) ${user.lastSeen}`}
              </p>
            )}
          </div>
        </div>
        {contactRows.length > 0 && (
          <ul className="mt-3 space-y-2">
            {contactRows.map((row) => (
              <li key={row.label} className="flex items-center gap-3 text-sm">
                <Icon name={row.icon} size={20} className="shrink-0 text-white/70" />
                <div className="min-w-0 flex-1">
                  <span className="text-white/70">{row.label}: </span>
                  <span className="text-white">{row.value}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-white/80 bg-white/10 hover:bg-white/15 hover:text-white"
            aria-label="Звонок"
          >
            <Icon name="phone" size={20} className="text-current" />
          </button>
          <button
            type="button"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-white/80 bg-white/10 hover:bg-white/15 hover:text-white"
            aria-label="Поиск"
          >
            <Icon name="search" size={20} className="text-current" />
          </button>
        </div>
      </header>

      <ScrollArea className="flex-1 px-4 py-3 space-y-4">
        {(photos > 0 || videos > 0 || files > 0 || links > 0) && (
          <div>
            <ul className="space-y-1.5">
              {photos > 0 && (
                <li>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left text-sm text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <Icon name="images" size={20} className="shrink-0 text-current" />
                    <span>{photos} фотографий</span>
                  </button>
                </li>
              )}
              {videos > 0 && (
                <li>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left text-sm text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <Icon name="videos" size={20} className="shrink-0 text-current" />
                    <span>{videos} видео</span>
                  </button>
                </li>
              )}
              {files > 0 && (
                <li>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left text-sm text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <Icon name="files" size={20} className="shrink-0 text-current" />
                    <span>{files} файла</span>
                  </button>
                </li>
              )}
              {links > 0 && (
                <li>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left text-sm text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <Icon name="links" size={20} className="shrink-0 text-current" />
                    <span>{links} ссылки</span>
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}

        {user.commonGroups && user.commonGroups.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-2">
              Общие группы и каналы
            </h3>
            <ul className="space-y-2">
              {user.commonGroups.map((group, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left text-sm text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <Avatar size="sm" className="bg-white/20 text-white">
                      {group.name.slice(0, 1)}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{group.name}</p>
                      {group.lastMessage && (
                        <p className="text-[11px] text-white/70 truncate">{group.lastMessage}</p>
                      )}
                    </div>
                    {group.unread != null && group.unread > 0 && (
                      <span className="flex-shrink-0 min-w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-[11px] text-white font-medium">
                        {group.unread}
                      </span>
                    )}
                    <Icon name="chevron-down" size={16} className="shrink-0 text-white/70" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <ul className="space-y-1.5">
            {USER_ACTIONS.map((action) => (
              <li key={action.label}>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left text-sm text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <Icon name={action.icon} size={20} className="shrink-0 text-current" />
                  <span>{action.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </ScrollArea>
    </div>
  );
}

export const RightPanel: React.FC<RightPanelProps> = ({
  title,
  participantsCount = 5,
  onlineCount = 2,
  user,
}) => {
  if (user) {
    return <RightPanelUser user={user} />;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden text-white">
      <header className="flex-shrink-0 px-4 pt-0 pb-3 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white mb-3">Информация о канале</h2>
        <div className="flex items-center gap-3">
          <Avatar size="lg" className="text-white/80 bg-white/20">
            {title.slice(0, 1)}
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{title}</p>
            <p className="text-[11px] text-white/70">
              {participantsCount} участников, {onlineCount} в сети
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            className="p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Звонок"
          >
            <Icon name="phone" size={20} className="text-current" />
          </button>
          <button
            type="button"
            className="p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Поиск"
          >
            <Icon name="search" size={20} className="text-current" />
          </button>
        </div>
      </header>

      <ScrollArea className="flex-1 px-4 py-3 space-y-4">
        <div>
          <ul className="space-y-1.5">
            {CHANNEL_MEDIA_ITEMS.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  className="w-full flex items-center gap-[12px] px-2 py-1.5 rounded-lg text-left text-sm text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <Icon name={item.icon} size={32} className="shrink-0 text-current" />
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-2 flex items-center gap-2">
            <Icon name="phone" size={14} className="text-current shrink-0" />
            Комнаты со звонками
          </h3>
          <ul className="space-y-1.5">
            {CALLS.map((call) => (
              <li key={call.name}>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <Icon name="phone" size={14} className="text-green-400 shrink-0" />
                  <span className="flex-1 truncate">{call.name}</span>
                  <span className="text-[11px] flex-shrink-0">{call.duration}</span>
                  <div className="flex -space-x-1.5 shrink-0">
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-5 h-5 rounded-full bg-white/20 border border-white/20"
                      />
                    ))}
                  </div>
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                className="w-full text-left text-[11px] text-white/70 hover:underline py-1"
              >
                и ещё 8 звонков
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Icon name="profile" size={14} className="text-current shrink-0" />
              Участники
            </span>
            <button
              type="button"
              className="p-1 rounded text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Icon name="plus" size={14} className="text-current" />
            </button>
          </h3>
          <ul className="space-y-2">
            {PARTICIPANTS.map((p, i) => (
              <li key={i} className="flex items-center gap-3">
                <Avatar size="sm" className="bg-white/20 text-white">{p.name.slice(0, 1)}</Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate flex items-center gap-1.5">
                    {p.name}
                    {p.isOwner && (
                      <span className="text-[10px] text-white/70 font-normal">Владелец</span>
                    )}
                  </p>
                  <p className="text-[11px] text-white/70 truncate">{p.status}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </ScrollArea>
    </div>
  );
};
