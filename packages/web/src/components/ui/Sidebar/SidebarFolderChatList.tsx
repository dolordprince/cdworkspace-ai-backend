import React from "react";
import { Link } from "react-router-dom";
import { Icon } from "../Icon";
import { Avatar } from "../Avatar";
import { Badge } from "../Badge";
import { sidebarRowClass } from "../../../lib/format";
import type { SidebarChat } from "./types";

interface SidebarFolderChatListProps {
  chats: SidebarChat[];
  activeStream?: string;
  activeDmId: number | null;
}

export const SidebarFolderChatList: React.FC<SidebarFolderChatListProps> = ({
  chats,
  activeStream,
  activeDmId,
}) => {
  if (chats.length === 0) return null;

  return (
    <div className="px-[8px] space-y-0.5">
      {chats.map((chat) => {
        if (chat.type === "stream") {
          const isActive = chat.name === activeStream;
          const displayName =
            chat.name.toLowerCase() === "general" ? "Общий чат" : chat.name;
          return (
            <Link
              key={`stream-${chat.stream_id}`}
              to={`/stream/${encodeURIComponent(chat.name)}`}
              className={`flex items-start gap-3 px-2.5 py-2.5 rounded-lg transition-colors ${sidebarRowClass(isActive)}`}
            >
              <Avatar size="md">#</Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">
                  #{displayName}
                </div>
                <div className="text-[12px] text-text-muted truncate mt-0.5">
                  Текст последнего сообщения...
                </div>
              </div>
              <Badge count={12} variant="unread" />
            </Link>
          );
        }
        const isActive = chat.id === activeDmId;
        return (
          <Link
            key={`dm-${chat.id}`}
            to={`/dm/${chat.id}`}
            className={`flex items-start gap-3 px-2.5 py-2.5 rounded-lg transition-colors ${sidebarRowClass(isActive)}`}
          >
            <Avatar size="md">{chat.name.slice(0, 1)}</Avatar>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <span className="text-sm font-medium text-text-primary truncate block">
                {chat.name}
              </span>
              <span className="text-[12px] text-text-muted truncate block mt-0.5">
                {chat.lastMessage ?? "Текст последнего сообщен..."}
              </span>
            </div>
            <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
              {chat.pinned && (
                <Icon name="pin" size={12} className="text-text-muted" />
              )}
              <span className="text-[11px] text-text-muted">
                {chat.time ?? "10:13"}
              </span>
              {chat.badge !== undefined && (
                <Badge count={chat.badge} variant="unread" />
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
};
