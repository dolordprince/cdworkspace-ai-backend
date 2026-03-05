import React, { useMemo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import EmojiPicker, { type EmojiClickData, Theme } from "emoji-picker-react";
import type { MockMessage, Reaction } from "../../lib/zulipClient";
import { getRealmBaseUrl } from "../../lib/zulipClient";
import { WORKSPACE_ORIGIN, WORKSPACE_UPLOADS_ORIGIN } from "../../lib/constants";
import { formatMessageTime } from "../../lib/format";
import { getJitsiMeetingUrl } from "../../lib/jitsi";
import { sanitizeHtml } from "../../lib/html";
import { useCallParticipantsStore } from "../../stores/callParticipantsStore";
import { useUsersStore } from "../../stores/usersStore";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

export function resolveAvatarSrc(relativeUrl: string | undefined | null): string | undefined {
  if (!relativeUrl?.trim()) return undefined;
  const s = relativeUrl.trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const base = getRealmBaseUrl() || WORKSPACE_ORIGIN || undefined;
  if (!base) return undefined;
  return `${base.replace(/\/+$/, "")}${s.startsWith("/") ? s : `/${s}`}`;
}

/** База для URL картинок в сообщениях (загрузки): при realm === workspace используем origin + api/v1. */
function getMessageImagesBaseUrl(): string | undefined {
  const realm = getRealmBaseUrl();
  if (WORKSPACE_ORIGIN && realm === WORKSPACE_ORIGIN && WORKSPACE_UPLOADS_ORIGIN) {
    return WORKSPACE_UPLOADS_ORIGIN;
  }
  return realm || WORKSPACE_UPLOADS_ORIGIN || undefined;
}

export interface MessageBubbleCallbacks {
  onReply?: (message: MockMessage) => void;
  onEdit?: (message: MockMessage) => void;
  onDelete?: (message: MockMessage) => void;
  onCopy?: (message: MockMessage) => void;
  onForward?: (message: MockMessage) => void;
  onStar?: (message: MockMessage) => void;
  onSelect?: (message: MockMessage) => void;
  onAddReaction?: (messageId: number, emojiName: string) => void;
  onOpenJitsiCall?: (url: string) => void;
  onStub?: (label: string) => void;
}

interface MessageBubbleProps {
  message: MockMessage;
  isOwn?: boolean;
  /** Показывать аватар (для одиночного сообщения; в группе аватар рисуется общим блоком). */
  showAvatar?: boolean;
  /** Показывать имя отправителя (только у первого сообщения в группе подряд). */
  showSenderName?: boolean;
  /** Сообщение внутри группы от одного отправителя: аватар рисуется снаружи, контент без своей колонки аватара. */
  inSenderGroup?: boolean;
  currentUserId?: number;
  selectionMode?: boolean;
  isSelected?: boolean;
  callbacks?: MessageBubbleCallbacks;
}

/** Популярные emoji_name → символ для отображения (fallback если emoji_code не сконвертировать). */
const EMOJI_NAME_TO_CHAR: Record<string, string> = {
  thumbs_up: "👍",
  heart: "❤️",
  smile: "😄",
  "+1": "👍",
  eyes: "👀",
  tada: "🎉",
  wave: "👋",
};

function emojiCodeToChar(emojiCode: string): string {
  try {
    const codePoints = emojiCode.split("-").map((hex) => parseInt(hex, 16));
    if (codePoints.some((n) => Number.isNaN(n))) return "";
    return String.fromCodePoint(...codePoints);
  } catch {
    return "";
  }
}

function getReactionDisplayChar(reaction: Reaction): string {
  const fromCode = emojiCodeToChar(reaction.emoji_code);
  if (fromCode) return fromCode;
  return EMOJI_NAME_TO_CHAR[reaction.emoji_name] ?? reaction.emoji_name;
}

/** Группировка реакций по (emoji_name, reaction_type): { count, userIds, displayChar }. */
function groupReactions(
  reactions: Reaction[]
): { key: string; count: number; userIds: number[]; displayChar: string }[] {
  const map = new Map<
    string,
    { userIds: number[]; displayChar: string }
  >();
  for (const r of reactions) {
    const key = `${r.reaction_type}:${r.emoji_name}`;
    const displayChar = getReactionDisplayChar(r);
    const existing = map.get(key);
    if (existing) {
      if (!existing.userIds.includes(r.user_id)) existing.userIds.push(r.user_id);
    } else {
      map.set(key, { userIds: [r.user_id], displayChar });
    }
  }
  return Array.from(map.entries()).map(([key, { userIds, displayChar }]) => ({
    key,
    count: userIds.length,
    userIds,
    displayChar,
  }));
}

const CONTEXT_ITEMS = [
  { label: "Просмотры", icon: "👁" },
  { label: "Ответить", icon: "↩" },
  { label: "Изменить", icon: "✎" },
  { label: "Закрепить сообщение", icon: "📌" },
  { label: "Копировать текст", icon: "📋" },
  { label: "Переслать", icon: "↗" },
  { label: "Пометить как важное", icon: "🚩" },
  { label: "Удалить", icon: "🗑" },
  { label: "Выбрать", icon: "☑" },
] as const;

const LABEL_TO_ACTION = {
  "Просмотры": "onStub",
  "Ответить": "onReply",
  "Изменить": "onEdit",
  "Закрепить сообщение": "onStub",
  "Копировать текст": "onCopy",
  "Переслать": "onForward",
  "Пометить как важное": "onStar",
  "Удалить": "onDelete",
  "Выбрать": "onSelect",
} as const;

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn = false,
  showAvatar = true,
  showSenderName = true,
  inSenderGroup = false,
  currentUserId,
  selectionMode = false,
  isSelected = false,
  callbacks,
}) => {
  const [open, setOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const user = useUsersStore((s) => s.getUser(message.sender_id));
  const displayName = (user?.full_name?.trim() || message.sender_full_name) ?? "";
  const avatarSrc = resolveAvatarSrc(user?.avatar_url ?? undefined);
  const time = formatMessageTime(message.timestamp);
  const reactionGroups = useMemo(
    () => (message.reactions?.length ? groupReactions(message.reactions) : []),
    [message.reactions]
  );

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(true);
  };

  const handleMenuAction = (label: (typeof CONTEXT_ITEMS)[number]["label"]) => {
    const action = LABEL_TO_ACTION[label];
    if (action === "onStub") {
      callbacks?.onStub?.(label);
    } else if (action && callbacks?.[action]) {
      (callbacks[action] as (msg: MockMessage) => void)(message);
    }
    setOpen(false);
  };

  const handleReaction = (emojiName: string) => {
    callbacks?.onAddReaction?.(message.id, emojiName);
    setEmojiPickerOpen(false);
    setOpen(false);
  };

  const handleEmojiPick = (data: EmojiClickData) => {
    const name = data.names?.[0] ?? data.emoji ?? "smile";
    handleReaction(name);
  };

  const jitsiUrl = getJitsiMeetingUrl(message.content);
  const isJitsiCall = jitsiUrl != null;
  const callParticipants = useCallParticipantsStore((s) =>
    jitsiUrl ? (s.participantsByUrl[jitsiUrl] ?? []) : []
  );

  const bubbleInner = isJitsiCall ? (
    <div
      role="button"
      tabIndex={0}
      onClick={() => callbacks?.onOpenJitsiCall?.(jitsiUrl)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          callbacks?.onOpenJitsiCall?.(jitsiUrl);
        }
      }}
      className={`px-3 py-2 pr-14 pb-5 rounded-lg relative cursor-pointer flex flex-col gap-1 ${
        isOwn
          ? "bg-accent/20 text-text-primary rounded-br-sm hover:bg-accent/30"
          : "bg-bg-elevated text-text-primary rounded-bl-sm hover:bg-bg-elevated/80"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon name="phone" size={18} className="text-current shrink-0" />
        <span>Присоединиться к звонку</span>
      </div>
      {callParticipants.length > 0 && (
        <p className="text-[11px] text-text-muted truncate">
          В звонке: {callParticipants.map((p) => p.displayName).join(", ")}
        </p>
      )}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[11px] text-text-muted">
        <span>{time}</span>
        {isOwn && (
          <span className="text-green-500 text-xs" title="Прочитано">
            ✓✓
          </span>
        )}
      </div>
    </div>
  ) : (
    <>
      <div
        className={`px-3 py-2 pr-14 pb-5 rounded-lg relative ${
          isOwn
            ? "bg-accent/20 text-text-primary rounded-br-sm"
            : "bg-bg-elevated text-text-primary rounded-bl-sm"
        }`}
      >
        <div
          className="message-body break-words [&_p]:mb-1 [&_p:last-child]:mb-0 [&_a]:text-accent [&_a]:underline hover:[&_a]:opacity-90 [&_pre]:bg-bg/50 [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-sm [&_blockquote]:border-l-2 [&_blockquote]:border-border-subtle [&_blockquote]:pl-2 [&_blockquote]:italic [&_blockquote]:text-text-muted [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:my-1"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.content, getMessageImagesBaseUrl()) }}
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[11px] text-text-muted">
          <span>{time}</span>
          {isOwn && (
            <span className="text-green-500 text-xs" title="Прочитано">
              ✓✓
            </span>
          )}
        </div>
        {reactionGroups.length > 0 && (
          <div
            className={`flex flex-wrap gap-1 mt-1.5 ${isOwn ? "justify-end" : "justify-start"}`}
          >
            {reactionGroups.map(({ key, count, userIds, displayChar }) => {
              const hasCurrentUser =
                currentUserId != null && userIds.includes(currentUserId);
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-sm border ${
                    hasCurrentUser
                      ? "bg-accent/25 border-accent/50"
                      : "bg-bg/50 border-border-subtle"
                  }`}
                  title={count > 0 ? `${displayChar} ${count}` : undefined}
                >
                  <span>{displayChar}</span>
                  {count > 1 && (
                    <span className="text-[11px] text-text-muted">{count}</span>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>
      {!isJitsiCall && (
      <DropdownMenu.Root open={open} onOpenChange={setOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={`absolute top-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-bg/50 text-text-muted hover:text-text-primary transition-opacity ${isOwn ? "left-1" : "right-1"}`}
            aria-label="Меню сообщения"
          >
            <Icon name="more" size={16} className="text-current" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="min-w-[200px] rounded-lg bg-bg-elevated border border-border-subtle shadow-lg py-1 z-50"
            sideOffset={4}
            align={isOwn ? "end" : "start"}
          >
            <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border-subtle">
              <button
                type="button"
                className="p-1 rounded hover:bg-bg/50 text-current"
                aria-label="Нравится"
                onClick={(e) => {
                  e.preventDefault();
                  handleReaction("heart");
                }}
              >
                <Icon name="heart" size={16} className="text-current" />
              </button>
              <button
                type="button"
                className="p-1 rounded hover:bg-bg/50 text-current"
                aria-label="Класс"
                onClick={(e) => {
                  e.preventDefault();
                  handleReaction("thumbs_up");
                }}
              >
                <Icon name="thumbs-up" size={16} className="text-current" />
              </button>
              <div className="relative">
                <button
                  type="button"
                  className="p-1 rounded hover:bg-bg/50 text-text-muted hover:text-text-primary w-6 h-6 flex items-center justify-center"
                  aria-label="Ещё реакции"
                  onClick={(e) => {
                    e.preventDefault();
                    setEmojiPickerOpen((v) => !v);
                  }}
                >
                  <Icon name="plus" size={14} className="text-current" />
                </button>
                {emojiPickerOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      aria-hidden
                      onClick={() => setEmojiPickerOpen(false)}
                    />
                    <div className="absolute left-0 top-full mt-1 z-50 shadow-xl rounded-xl overflow-hidden border border-border-subtle bg-bg-elevated">
                      <EmojiPicker
                        onEmojiClick={handleEmojiPick}
                        theme={document.documentElement.dataset.theme === "light" ? Theme.LIGHT : Theme.DARK}
                        width={320}
                        height={360}
                        searchDisabled={false}
                        previewConfig={{ showPreview: false }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
            {CONTEXT_ITEMS.filter(
              (item) => item.label !== "Изменить" || isOwn
            ).map((item) => (
              <DropdownMenu.Item
                key={item.label}
                className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg/80 outline-none cursor-pointer data-[highlighted]:bg-accent/20"
                onSelect={(e) => {
                  e.preventDefault();
                  handleMenuAction(item.label);
                }}
              >
                <span className="text-xs opacity-70">{item.icon}</span>
                {item.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      )}
    </>
  );

  if (inSenderGroup) {
    return (
      <div
        className={`py-2 group hover:bg-bg-elevated/30 relative ${isSelected ? "ring-1 ring-accent rounded-lg" : ""}`}
        onContextMenu={handleContextMenu}
      >
        <div className={`min-w-0 ${isOwn ? "flex flex-col items-end" : ""}`}>
          {showSenderName && (
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-semibold text-text-primary">{displayName}</span>
              {message.subject && (
                <span className={`text-[11px] font-medium ${isOwn ? "text-green-400" : "text-accent-soft"}`}>
                  #{message.subject}
                </span>
              )}
            </div>
          )}
          <div
            className={`rounded-lg text-sm leading-relaxed max-w-[85%] relative ${
              showSenderName ? "mt-1" : "mt-0.5"
            } ${isOwn ? "flex flex-col items-end" : ""}`}
          >
            {bubbleInner}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-2 px-4 py-2 group hover:bg-bg-elevated/30 relative ${
        isOwn ? "flex-row-reverse" : ""
      } ${isSelected ? "ring-1 ring-accent rounded-lg" : ""}`}
      onContextMenu={handleContextMenu}
    >
      {!isOwn && (
        showAvatar ? (
          <Avatar size="sm" className="bg-bg-elevated text-accent-soft flex-shrink-0" src={avatarSrc ?? undefined}>
            {displayName.slice(0, 1)}
          </Avatar>
        ) : (
          <div className="w-8 flex-shrink-0" aria-hidden />
        )
      )}
      {isOwn && <div className="w-8 flex-shrink-0" />}
      <div className={`flex-1 min-w-0 ${isOwn ? "flex flex-col items-end" : ""}`}>
        {showSenderName && (
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text-primary">
              {displayName}
            </span>
            {message.subject && (
              <span
                className={`text-[11px] font-medium ${
                  isOwn ? "text-green-400" : "text-accent-soft"
                }`}
              >
                #{message.subject}
              </span>
            )}
          </div>
        )}
        <div
          className={`rounded-lg text-sm leading-relaxed max-w-[85%] relative ${
            showSenderName ? "mt-1" : "mt-0.5"
          } ${isOwn ? "flex flex-col items-end" : ""}`}
        >
          {bubbleInner}
        </div>
      </div>
    </div>
  );
};
