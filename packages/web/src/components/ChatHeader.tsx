import React from "react";
import { Icon } from "./ui/Icon";

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
}) => {
  const infoLabel = rightPanelLabel ?? "Информация о канале";
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
      <div className="flex flex-col min-w-0">
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
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="p-2 rounded-lg text-text-muted hover:bg-bg/50 hover:text-text-primary"
          aria-label="Звонок"
        >
          <Icon name="phone" size={20} className="text-current" />
        </button>
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
