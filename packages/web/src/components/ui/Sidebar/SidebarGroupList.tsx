import React from "react";
import { Link } from "react-router-dom";
import { Icon } from "../Icon";
import { Avatar } from "../Avatar";
import { Badge } from "../Badge";
import { MOCK_GROUPS } from "./data";
import type { SidebarChat } from "./types";

interface SidebarGroupListProps {
  activeDmIdParam: string | null;
  expandedGroupIds: Set<number>;
  onToggleGroup: (id: number) => void;
  /** Групповые ЛС из последних сообщений. Если не переданы, показываются моки. */
  groupChats?: Extract<SidebarChat, { type: "dm" }>[];
}

interface GroupChat {
  type: "dm";
  id: number;
  name: string;
  slug: string;
  isGroup: true;
  lastMessage?: string;
  time?: string;
  badge?: number;
  pinned?: boolean;
  userIds?: number[];
}

export const SidebarGroupList: React.FC<SidebarGroupListProps> = ({
  activeDmIdParam,
  expandedGroupIds,
  onToggleGroup,
  groupChats,
}) => {
  const source: SidebarChat[] = groupChats && groupChats.length > 0 ? groupChats : MOCK_GROUPS;
  const filtered = source.filter((c): c is GroupChat => c.type === "dm" && c.isGroup === true);
  const list: GroupChat[] = filtered;
  return (
    <div className="px-3 space-y-0.5">
      {list.map((chat) => {
        const isActive = chat.slug === activeDmIdParam;
        const expanded = expandedGroupIds.has(chat.id);
        return (
          <div key={`group-${chat.id}`}>
            <div
              className={`flex items-start gap-3 px-2.5 py-2.5 rounded-lg transition-colors ${expanded ? "bg-sidebar-hover" : ""} ${isActive ? "bg-sidebar-hover" : ""}`}
            >
              <Link to={`/dm/${chat.slug}`} className="flex-1 min-w-0 flex items-start gap-3">
                <Avatar size="md">
                  <Icon name="channels" size={18} className="text-text-muted" />
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">{chat.name}</div>
                  <div className="text-[12px] text-text-muted truncate mt-0.5">{chat.lastMessage}</div>
                </div>
              </Link>
              <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); onToggleGroup(chat.id); }}
                  className="text-text-muted hover:text-text-primary p-0.5"
                  aria-label={expanded ? "Свернуть" : "Развернуть"}
                >
                  {expanded ? <Icon name="chevron-up" size={14} /> : <Icon name="chevron-down" size={14} />}
                </button>
                {chat.badge !== undefined && <Badge count={chat.badge} variant="unread" rounded="md" />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
