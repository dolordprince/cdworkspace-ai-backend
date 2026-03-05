import type { ReactNode } from "react";
import React from "react";
import { useChatListStore } from "../../stores/chatListStore";
import { useUsersStore } from "../../stores/usersStore";
import { getRealmBaseUrl } from "../../lib/zulipClient";
import { getPresenceState } from "../../lib/format";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

function resolveAvatarSrc(url: string | undefined | null): string | undefined {
  if (!url?.trim()) return undefined;
  const s = url.trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const base = getRealmBaseUrl();
  if (!base) return undefined;
  return `${base.replace(/\/+$/, "")}${s.startsWith("/") ? s : `/${s}`}`;
}

export type TopBarSection = "chat" | "calendar" | "mail" | "calls";

interface TopBarProps {
  activeSection: TopBarSection;
  onSectionChange: (section: TopBarSection) => void;
  onOpenSearch?: () => void;
  /** Открыть шторку профиля текущего пользователя */
  onOpenProfile?: () => void;
  /** Контент слева (например, переключатель инстансов) */
  leftContent?: ReactNode;
}

const SECTIONS: { id: TopBarSection; icon: "chatBubble" | "calendar" | "mail" | "phone"; label: string }[] = [
  { id: "chat", icon: "chatBubble", label: "Чаты" },
  { id: "calendar", icon: "calendar", label: "Календарь" },
  { id: "mail", icon: "mail", label: "Почта" },
  { id: "calls", icon: "phone", label: "Звонки" },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onSectionChange,
  onOpenSearch,
  onOpenProfile,
  leftContent,
}) => {
  const currentUserId = useChatListStore((s) => s.currentUserId);
  const currentUser = useUsersStore((s) =>
    currentUserId != null ? s.getUser(currentUserId) : undefined
  );
  const displayName = currentUser?.full_name?.trim() || "Пользователь";
  const avatarLetter = displayName[0]?.toUpperCase() ?? "?";
  const avatarSrc = resolveAvatarSrc(currentUser?.avatar_url ?? undefined);
  const presenceState =
    currentUser?.presence != null
      ? getPresenceState(currentUser.presence.timestamp, currentUser.presence.status)
      : null;

  return (
    <header className="w-full bg-bg-elevated flex items-center justify-between p-[8px] border-b border-border-subtle gap-4 rounded-b-[12px] mb-1">
      {/* Слева: переключатель инстансов */}
      <div className="flex-shrink-0 min-w-0">{leftContent}</div>
      {/* Центр: секции приложения */}
      <div className="flex-1 flex flex-col items-center justify-center gap-1.5 min-w-0">
        <div className="flex items-center gap-2">
          {SECTIONS.map(({ id, icon, label }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSectionChange(id)}
                className={`w-16 h-16 flex items-center justify-center rounded-[12px] opacity-100 transition-colors ${
                  isActive
                    ? "bg-[var(--color-Icon-disable,#FFFFFF1A)] text-text-primary"
                    : "text-text-muted hover:bg-bg/50 hover:text-text-primary"
                }`}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon name={icon} size={40} className="text-current" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Справа: профиль текущего пользователя — по клику открывается шторка */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={onOpenProfile}
          className="relative flex items-center gap-2 p-1.5 rounded-lg text-left hover:bg-bg/50 transition-colors"
          aria-label="Профиль"
        >
          <div className="relative flex-shrink-0">
            <Avatar size="xs" src={avatarSrc}>
              {avatarLetter}
            </Avatar>
            {presenceState === "active" && (
              <span
                className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-bg-elevated"
                aria-label="онлайн"
              />
            )}
            {presenceState === "idle" && (
              <span
                className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-bg-elevated"
                aria-label="не активен"
              />
            )}
          </div>
          <div className="hidden sm:flex flex-col items-start leading-tight">
            <span className="text-sm font-medium text-text-primary">
              {displayName}
            </span>
          </div>
          <Icon name="chevron-down" size={16} className="text-text-muted shrink-0" />
        </button>
      </div>
    </header>
  );
};
