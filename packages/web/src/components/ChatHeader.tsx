import React from "react";
import { getRealmBaseUrl } from "../lib/zulipClient";
import { Icon } from "./ui/Icon";
import { Avatar } from "./ui/Avatar";

/** Данные собеседника для заголовка личного чата: аватар, имя, онлайн-статус */
export interface ChatHeaderDmPartner {
  avatarUrl?: string | null;
  name: string;
  /** active = в сети, idle = не активен, null = не в сети */
  presenceState: "active" | "idle" | null;
  /** Текст «был(а) N назад» при отсутствии в сети */
  lastSeen?: string;
}

function resolveAvatarSrc(url: string | undefined | null): string | undefined {
  if (!url?.trim()) return undefined;
  const s = url.trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const base = getRealmBaseUrl();
  if (!base) return undefined;
  return `${base.replace(/\/+$/, "")}${s.startsWith("/") ? s : `/${s}`}`;
}

interface ChatHeaderProps {
  channelName: string;
  topic?: string;
  participantsCount?: number;
  onlineCount?: number;
  onOpenSearch?: () => void;
  onToggleRightPanel?: () => void;
  rightPanelOpen?: boolean;
  /** Подпись кнопки панели (например "Информация о собеседнике" в личном чате) */
  rightPanelLabel?: string;
  hideTopic?: boolean;
  /** Скрыть строку «N участников, M в сети» (для личного чата) */
  hideParticipants?: boolean;
  /** Кнопка «Позвонить» (только в ЛС). При клике создаётся ссылка на Jitsi и отправляется сообщением. */
  onCallClick?: () => void;
  /** Для личного чата: показывать аватар, ник и статус собеседника вместо channelName */
  dmPartner?: ChatHeaderDmPartner;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  channelName,
  topic = "Общий чат",
  participantsCount = 5,
  onlineCount = 2,
  onOpenSearch,
  onToggleRightPanel,
  rightPanelOpen = true,
  rightPanelLabel,
  hideTopic = false,
  hideParticipants = false,
  onCallClick,
  dmPartner,
}) => {
  const infoLabel = rightPanelLabel ?? "Информация о канале";
  const avatarSrc = dmPartner ? resolveAvatarSrc(dmPartner.avatarUrl) : undefined;
  const statusText =
    dmPartner?.presenceState === "active"
      ? "В сети"
      : dmPartner?.presenceState === "idle"
        ? "Не активен"
        : dmPartner?.lastSeen != null
          ? dmPartner.lastSeen === "онлайн"
            ? "В сети"
            : `был(а) ${dmPartner.lastSeen}`
          : "Не в сети";

  return (
    <header className="flex-shrink-0 py-5 px-5 flex items-center justify-between rounded-[12px] bg-[#333333]">
      <button
        type="button"
        onClick={onToggleRightPanel}
        className="p-2 -ml-2 rounded-lg text-text-muted hover:bg-bg/50 hover:text-text-primary shrink-0"
        aria-label={rightPanelOpen ? "Скрыть панель" : infoLabel}
      >
        <Icon name="moreVert" size={20} className="text-current" />
      </button>
      <div className="flex flex-col min-w-0 flex-1 min-w-0">
        {dmPartner ? (
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <Avatar
                size="md"
                className="bg-bg-elevated text-text-muted border border-border-subtle"
                src={avatarSrc}
              >
                {dmPartner.name.slice(0, 1).toUpperCase()}
              </Avatar>
              {dmPartner.presenceState === "active" && (
                <span
                  className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#333333]"
                  aria-label="онлайн"
                />
              )}
              {dmPartner.presenceState === "idle" && (
                <span
                  className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-[#333333]"
                  aria-label="не активен"
                />
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <h1 className="text-sm font-semibold text-text-primary truncate">
                {dmPartner.name}
              </h1>
              <p className="text-[11px] text-text-muted truncate">{statusText}</p>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-sm font-semibold text-text-primary truncate">
              {channelName}
              {!hideTopic && topic && (
                <span className="text-text-muted font-normal"> | #{topic}</span>
              )}
            </h1>
            {!hideParticipants && (
              <p className="text-[11px] text-text-muted mt-0.5">
                {participantsCount} участников, {onlineCount} в сети
              </p>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        {onCallClick != null && (
          <button
            type="button"
            onClick={onCallClick}
            className="p-2 rounded-lg text-text-muted hover:bg-bg/50 hover:text-text-primary"
            aria-label="Звонок"
          >
            <Icon name="phone" size={20} className="text-current" />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenSearch}
          className="p-2 rounded-lg text-text-muted hover:bg-bg/50 hover:text-text-primary"
          aria-label="Поиск"
        >
          <Icon name="search" size={20} className="text-current" />
        </button>
      </div>
    </header>
  );
};
