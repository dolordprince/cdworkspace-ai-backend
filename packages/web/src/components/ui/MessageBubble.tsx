import React, { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { MockMessage } from "../../lib/zulipClient";
import { formatMessageTime } from "../../lib/format";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

interface MessageBubbleProps {
  message: MockMessage;
  isOwn?: boolean;
  showAvatar?: boolean;
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

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn = false,
  showAvatar = true,
}) => {
  const [open, setOpen] = useState(false);
  const time = formatMessageTime(message.timestamp);

  return (
    <div
      className={`flex gap-2 px-4 py-2 group hover:bg-bg-elevated/30 relative ${
        isOwn ? "flex-row-reverse" : ""
      }`}
    >
      {showAvatar && !isOwn && (
        <Avatar size="sm" className="bg-bg-elevated text-accent-soft">
          {message.sender_full_name.slice(0, 1)}
        </Avatar>
      )}
      {showAvatar && isOwn && <div className="w-8 flex-shrink-0" />}
      <div className={`flex-1 min-w-0 ${isOwn ? "flex flex-col items-end" : ""}`}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-semibold text-text-primary">
            {message.sender_full_name}
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
        <div
          className={`mt-1 rounded-lg text-sm leading-relaxed max-w-[85%] relative ${
            isOwn ? "flex flex-col items-end" : ""
          }`}
        >
          <div
            className={`px-3 py-2 rounded-lg whitespace-pre-wrap relative ${
              isOwn
                ? "bg-accent/20 text-text-primary rounded-br-sm"
                : "bg-bg-elevated text-text-primary rounded-bl-sm"
            }`}
          >
            {message.content}
            <div className="flex items-center justify-end gap-1 mt-1.5">
              <span className="text-[11px] text-text-muted">{time}</span>
              {isOwn && (
                <span className="text-green-500 text-xs" title="Прочитано">
                  ✓✓
                </span>
              )}
            </div>
            {/* Реакции при наведении */}
            <div
              className={`absolute bottom-1 flex items-center gap-0.5 rounded-full bg-bg-elevated/95 border border-border-subtle px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                isOwn ? "right-1" : "left-1"
              }`}
            >
              <button
                type="button"
                className="p-0.5 rounded hover:bg-bg/50 text-current"
                aria-label="Нравится"
              >
                <Icon name="heart" size={16} className="text-current" />
              </button>
              <button
                type="button"
                className="p-0.5 rounded hover:bg-bg/50 text-current"
                aria-label="Класс"
              >
                <Icon name="thumbs-up" size={16} className="text-current" />
              </button>
              <button
                type="button"
                className="p-0.5 rounded hover:bg-bg/50 text-text-muted hover:text-text-primary w-5 h-5 flex items-center justify-center"
                aria-label="Ещё реакции"
              >
                <Icon name="plus" size={14} className="text-current" />
              </button>
            </div>
          </div>
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
              {/* По макету: строка реакций (сердечко, палец вверх, +) сверху контекстного меню */}
              <div className="flex items-center gap-0.5 px-3 py-2 border-b border-border-subtle">
                <button
                  type="button"
                  className="p-1 rounded hover:bg-bg/50 text-current"
                  aria-label="Нравится"
                >
                  <Icon name="heart" size={16} className="text-current" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-bg/50 text-current"
                  aria-label="Класс"
                >
                  <Icon name="thumbs-up" size={16} className="text-current" />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-bg/50 text-text-muted hover:text-text-primary w-6 h-6 flex items-center justify-center"
                  aria-label="Ещё реакции"
                >
                  <Icon name="plus" size={14} className="text-current" />
                </button>
              </div>
              {CONTEXT_ITEMS.map((item, i) => (
                <DropdownMenu.Item
                  key={item.label}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg/80 outline-none cursor-pointer data-[highlighted]:bg-accent/20"
                >
                  <span className="text-xs opacity-70">{item.icon}</span>
                  {item.label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        </div>
      </div>
    </div>
  );
};
