import React from "react";
import { Link } from "react-router-dom";
import { Icon } from "../Icon";
import { Avatar } from "../Avatar";
import { Badge } from "../Badge";
import { sidebarRowClass } from "../../../lib/format";
import { MOCK_DMS } from "./data";
import type { SidebarChat } from "./types";

interface SidebarDmListProps {
  activeDmId: number | null;
}

function isDm(chat: SidebarChat): chat is Extract<SidebarChat, { type: "dm" }> {
  return chat.type === "dm" && !chat.isGroup;
}

export const SidebarDmList: React.FC<SidebarDmListProps> = ({ activeDmId }) => {
  return (
    <div className="px-3 space-y-0.5">
      {MOCK_DMS.filter(isDm).map((chat) => {
        const isActive = chat.id === activeDmId;
        return (
          <Link
            key={`dm-${chat.id}`}
            to={`/dm/${chat.id}`}
            className={`flex items-start gap-3 px-2.5 py-2.5 rounded-lg transition-colors ${sidebarRowClass(isActive)}`}
          >
            <Avatar size="md">11{chat.name.slice(0, 1)}</Avatar>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <span className="text-sm font-medium text-text-primary truncate block">
                {chat.name}
              </span>
              <span className="text-[12px] text-text-muted truncate block mt-0.5">
                {chat.lastMessage ?? "Текст последнего сообщен..."}
              </span>
            </div>
            <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
              <div className="flex items-center gap-1">
                {chat.pinned && (
                  <Icon name="pin" size={12} className="text-text-muted" />
                )}
                <span className="text-[11px] text-text-muted">
                  {chat.time ?? "10:13"}
                </span>
              </div>
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
