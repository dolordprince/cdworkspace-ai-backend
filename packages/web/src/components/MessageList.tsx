import React, { useRef, useEffect } from "react";
import type { MockMessage } from "../lib/zulipClient";
import { SCROLL_AREA_CLASS } from "../lib/constants";
import { MessageBubble } from "./ui/MessageBubble";
import { CallBubble } from "./ui/CallBubble";

interface MessageListProps {
  messages: MockMessage[];
  currentUserId?: number;
  /** При смене ключа (чат/топик/ЛС) скролл сбрасывается вниз к последним сообщениям */
  scrollToBottomKey?: string;
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

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUserId = 999,
  scrollToBottomKey,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  const pendingScrollToBottomKeyRef = useRef<string | null>(null);

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
    const threshold = 80;
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
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

  return (
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
          {items.map((m, i) => (
            <React.Fragment key={m.id}>
              <MessageBubble
                message={m}
                isOwn={m.sender_id === currentUserId}
                showAvatar
              />
              {groupIndex === 0 && i === Math.min(1, items.length - 1) && (
                <CallBubble key={`call-${dateKey}`} callName="Название звонка" topic="Тема 2" duration="0:47" />
              )}
            </React.Fragment>
          ))}
        </div>
      ))}
      <div className="h-2 shrink-0" aria-hidden />
    </div>
  );
};
