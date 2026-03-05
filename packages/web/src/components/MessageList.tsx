import React, { useRef, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { MockMessage } from "../lib/zulipClient";
import { SCROLL_AREA_CLASS } from "../lib/constants";
import { MessageBubble, type MessageBubbleCallbacks, resolveAvatarSrc } from "./ui/MessageBubble";
import { Avatar } from "./ui/Avatar";
import { Icon } from "./ui/Icon";
import { useUsersStore } from "../stores/usersStore";

const SCROLL_AT_BOTTOM_THRESHOLD = 80;

export interface MessageListCallbacks {
  onMessageReply?: (message: MockMessage) => void;
  onMessageEdit?: (message: MockMessage) => void;
  onMessageDelete?: (message: MockMessage) => void;
  onMessageCopy?: (message: MockMessage) => void;
  onMessageForward?: (message: MockMessage) => void;
  onMessageStar?: (message: MockMessage) => void;
  onMessageSelect?: (message: MockMessage) => void;
  onMessageAddReaction?: (messageId: number, emojiName: string) => void;
  onOpenJitsiCall?: (url: string) => void;
  onStub?: (label: string) => void;
}

interface MessageListProps {
  messages: MockMessage[];
  currentUserId?: number;
  /** При смене ключа (чат/топик/ЛС) скролл сбрасывается вниз к последним сообщениям */
  scrollToBottomKey?: string;
  callbacks?: MessageListCallbacks;
  selectionMode?: boolean;
  selectedMessageIds?: Set<number>;
}

function getDateKey(ts: number): string {
  const d = new Date(ts * 1000);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Сегодня";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function scrollToBottom(el: HTMLElement | null) {
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

/** Группа сообщений от одного отправителя: один аватар по нижней границе блока. */
function SenderMessageGroup({
  messages,
  currentUserId,
  bubbleCallbacks,
  selectionMode,
  selectedMessageIds,
}: {
  messages: MockMessage[];
  currentUserId?: number;
  bubbleCallbacks?: MessageBubbleCallbacks;
  selectionMode?: boolean;
  selectedMessageIds?: Set<number>;
}) {
  const user = useUsersStore((s) => s.getUser(messages[0].sender_id));
  const displayName = (user?.full_name?.trim() || messages[0].sender_full_name) ?? "";
  const avatarSrc = resolveAvatarSrc(user?.avatar_url ?? undefined);

  return (
    <>
      <div className="flex gap-2 px-4 items-stretch">
        <div className="w-8 flex flex-col justify-end flex-shrink-0 pb-2">
          <Avatar size="sm" className="bg-bg-elevated text-accent-soft" src={avatarSrc ?? undefined}>
            {displayName.slice(0, 1)}
          </Avatar>
        </div>
        <div className="flex-1 min-w-0">
          {messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              isOwn={false}
              showSenderName={i === 0}
              inSenderGroup
              currentUserId={currentUserId}
              callbacks={bubbleCallbacks}
              selectionMode={selectionMode}
              isSelected={selectedMessageIds?.has(m.id)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId,
  scrollToBottomKey,
  callbacks,
  selectionMode = false,
  selectedMessageIds,
}) => {
  const bubbleCallbacks: MessageBubbleCallbacks | undefined = useMemo(
    () =>
      callbacks
        ? {
            onReply: callbacks.onMessageReply,
            onEdit: callbacks.onMessageEdit,
            onDelete: callbacks.onMessageDelete,
            onCopy: callbacks.onMessageCopy,
            onForward: callbacks.onMessageForward,
            onStar: callbacks.onMessageStar,
            onSelect: callbacks.onMessageSelect,
            onAddReaction: callbacks.onMessageAddReaction,
            onOpenJitsiCall: callbacks.onOpenJitsiCall,
            onStub: callbacks.onStub,
          }
        : undefined,
    [callbacks]
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  const pendingScrollToBottomKeyRef = useRef<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // При переключении чата/топика запоминаем, что нужно скролл вниз после загрузки сообщений
  useEffect(() => {
    if (scrollToBottomKey === undefined) return;
    pendingScrollToBottomKeyRef.current = scrollToBottomKey;
  }, [scrollToBottomKey]);

  // Скролл вниз: после загрузки сообщений при смене чата или если пользователь уже был внизу (своё сообщение)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pending = pendingScrollToBottomKeyRef.current;
    if (pending !== null && scrollToBottomKey !== undefined && pending === scrollToBottomKey) {
      pendingScrollToBottomKeyRef.current = null;
      scrollToBottom(el);
      return;
    }
    if (messages.length === 0) return;
    if (wasAtBottomRef.current) scrollToBottom(el);
  }, [scrollToBottomKey, messages.length]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_AT_BOTTOM_THRESHOLD;
    wasAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
  };

  // Синхронизация isAtBottom после рендера (короткий чат без прокрутки)
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setIsAtBottom(
      el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_AT_BOTTOM_THRESHOLD
    );
  }, [messages.length]);

  const scrollToBottomClick = () => {
    scrollToBottom(scrollRef.current);
  };

  const groups: { dateKey: string; items: MockMessage[] }[] = [];
  let currentDateKey = "";

  messages.forEach((msg) => {
    const dateKey = getDateKey(msg.timestamp);
    if (dateKey !== currentDateKey) {
      currentDateKey = dateKey;
      groups.push({ dateKey, items: [msg] });
    } else {
      groups[groups.length - 1].items.push(msg);
    }
  });

  /** Разбивает массив сообщений на группы подряд идущих от одного отправителя. */
  function getSenderGroups(items: MockMessage[]): MockMessage[][] {
    const result: MockMessage[][] = [];
    for (const msg of items) {
      const last = result[result.length - 1];
      if (last && last[0].sender_id === msg.sender_id) last.push(msg);
      else result.push([msg]);
    }
    return result;
  }

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto min-h-0 overscroll-behavior-contain ${SCROLL_AREA_CLASS}`}
        onScroll={handleScroll}
        role="feed"
        aria-label="Переписка"
      >
        {groups.map(({ dateKey, items }, groupIndex) => (
        <div key={dateKey}>
          <div className="sticky top-0 z-10 flex justify-center py-2">
            <span className="px-3 py-1 rounded-full bg-bg-elevated/90 text-[11px] text-text-muted border border-border-subtle">
              {dateKey}
            </span>
          </div>
          {(() => {
            const senderGroups = getSenderGroups(items);
            return senderGroups.map((senderMessages) => {
              const isOwn = senderMessages[0].sender_id === currentUserId;

              if (isOwn) {
                return (
                  <React.Fragment key={`own-${senderMessages[0].id}`}>
                    {senderMessages.map((m, i) => (
                      <MessageBubble
                        key={m.id}
                        message={m}
                        isOwn
                        showAvatar={false}
                        showSenderName={i === 0}
                        currentUserId={currentUserId}
                        callbacks={bubbleCallbacks}
                        selectionMode={selectionMode}
                        isSelected={selectedMessageIds?.has(m.id)}
                      />
                    ))}
                  </React.Fragment>
                );
              }

              return (
                <SenderMessageGroup
                  key={`group-${senderMessages[0].id}`}
                  messages={senderMessages}
                  currentUserId={currentUserId}
                  bubbleCallbacks={bubbleCallbacks}
                  selectionMode={selectionMode}
                  selectedMessageIds={selectedMessageIds}
                />
              );
            });
          })()}
        </div>
      ))}
        <div className="h-2 shrink-0" aria-hidden />
      </div>
      {!isAtBottom && (
        <div className="absolute bottom-4 right-4 z-20">
          <button
            type="button"
            onClick={scrollToBottomClick}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-bg-elevated border border-border-subtle shadow-lg text-text-primary hover:bg-bg-elevated/90 focus:outline-none focus:ring-2 focus:ring-accent-soft"
            aria-label="Прокрутить вниз"
          >
            <Icon name="chevron-down" className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
