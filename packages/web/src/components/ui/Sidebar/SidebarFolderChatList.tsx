import React from "react";
import { Link } from "react-router-dom";
import { Icon } from "../Icon";
import { Avatar } from "../Avatar";
import { Badge } from "../Badge";
import { sidebarRowClass, getPresenceState } from "../../../lib/format";
import { getRealmBaseUrl } from "../../../lib/zulipClient";
import { useUsersStore } from "../../../stores/usersStore";
import { slugForStream, TOPIC_BAR_COLORS } from "./data";
import type { SidebarChat } from "./types";

/** Возвращает URL аватарки: если уже абсолютный (gravatar и т.д.) — как есть, иначе realm + путь. */
function getAvatarUrl(avatarUrl: string | undefined): string | null {
  if (!avatarUrl?.trim()) return null;
  const s = avatarUrl.trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const base = getRealmBaseUrl();
  if (!base) return null;
  const path = s.startsWith("/") ? s : `/${s}`;
  return `${base.replace(/\/+$/, "")}${path}`;
}

function DmChatRow({
  chat,
  isActive,
}: {
  chat: Extract<SidebarChat, { type: "dm" }>;
  isActive: boolean;
}) {
  const partnerUserId = chat.isGroup ? null : chat.id;
  const user = useUsersStore((s) =>
    partnerUserId != null ? s.getUser(partnerUserId) : undefined
  );
  const presenceState =
    user?.presence != null
      ? getPresenceState(user.presence.timestamp, user.presence.status)
      : null;
  const avatarSrc = !chat.isGroup ? getAvatarUrl(chat.avatar_url) : null;
  return (
    <Link
      to={`/dm/${chat.slug}`}
      className={`flex items-start gap-3 px-2.5 py-2.5 rounded-lg transition-colors ${sidebarRowClass(isActive)}`}
    >
      <div className="relative shrink-0">
        <Avatar size="md" src={avatarSrc ?? undefined}>
          {chat.name.slice(0, 1)}
        </Avatar>
        {presenceState === "active" && (
          <span
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-bg"
            aria-label="онлайн"
          />
        )}
        {presenceState === "idle" && (
          <span
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-bg"
            aria-label="не активен"
          />
        )}
      </div>
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
}

interface SidebarFolderChatListProps {
  chats: SidebarChat[];
  activeStreamSlug: string | null;
  activeDmIdParam: string | null;
  activeTopic?: string | null;
  expandedStreamSlug?: string | null;
  onToggleStream?: (slug: string) => void;
}

export const SidebarFolderChatList: React.FC<SidebarFolderChatListProps> = ({
  chats,
  activeStreamSlug,
  activeDmIdParam,
  activeTopic,
  expandedStreamSlug,
  onToggleStream,
}) => {
  if (chats.length === 0) return null;

  const canExpandStreams = onToggleStream != null && expandedStreamSlug !== undefined;

  return (
    <div className="px-[8px] space-y-0.5">
      {chats.map((chat) => {
        if (chat.type === "stream") {
          const streamSlug = slugForStream(chat);
          const isActive = streamSlug === activeStreamSlug;
          const expanded = canExpandStreams && expandedStreamSlug === streamSlug;
          const displayName =
            chat.name.toLowerCase() === "general" ? "Общий чат" : chat.name;
          const topics = chat.topics ?? [];

          if (canExpandStreams) {
            return (
              <div key={`stream-${chat.stream_id}`}>
                <div
                  className={`flex items-start gap-3 px-2.5 py-2.5 rounded-lg transition-colors ${
                    expanded ? "bg-sidebar-hover" : ""
                  } ${isActive ? "bg-sidebar-hover" : ""}`}
                >
                  <Link
                    to={`/stream/${streamSlug}`}
                    className="flex-1 min-w-0 flex items-start gap-3"
                  >
                    <Avatar size="md">#</Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate">
                        #{displayName}
                      </div>
                      <div className="text-[12px] text-text-muted truncate mt-0.5">
                        {chat.lastMessage ?? "Текст последнего сообщения..."}
                      </div>
                    </div>
                  </Link>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleStream(streamSlug);
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-sidebar-hover"
                      aria-label={
                        expanded ? "Свернуть темы" : "Развернуть темы"
                      }
                    >
                      {expanded ? (
                        <Icon name="chevron-up" size={16} />
                      ) : (
                        <Icon name="chevron-down" size={16} />
                      )}
                    </button>
                    {chat.badge !== undefined && chat.badge > 0 && (
                      <Badge count={chat.badge} variant="unread" />
                    )}
                  </div>
                </div>
                {expanded && (
                  <div className="ml-4 pl-2 mt-0.5 space-y-0.5 border-l-2 border-transparent">
                    {topics.length === 0 ? (
                      <div className="pl-3 py-2 text-[12px] text-text-muted">
                        Нет тем
                      </div>
                    ) : (
                      topics.map((topic, idx) => {
                        const topicColor =
                          TOPIC_BAR_COLORS[idx % TOPIC_BAR_COLORS.length];
                        const isTopicActive =
                          streamSlug === activeStreamSlug && activeTopic === topic.subject;
                        return (
                          <Link
                            key={topic.subject}
                            to={`/stream/${streamSlug}/topic/${encodeURIComponent(topic.subject)}`}
                            className={`flex items-start gap-3 pl-3 py-2 rounded-r-lg transition-colors border-l-4 ${sidebarRowClass(isTopicActive)}`}
                            style={{ borderLeftColor: topicColor }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-text-primary truncate">
                                # {topic.subject}
                              </div>
                              <div className="text-[12px] text-sidebar-sender truncate mt-0.5">
                                Участник
                              </div>
                              <div className="text-[12px] text-text-muted truncate mt-0.5">
                                {topic.lastMessage ?? "Текст последнего сообщен..."}
                              </div>
                            </div>
                            {topic.badge !== undefined && topic.badge > 0 && (
                              <Badge count={topic.badge} variant="unread" />
                            )}
                          </Link>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={`stream-${chat.stream_id}`}
              to={`/stream/${streamSlug}`}
              className={`flex items-start gap-3 px-2.5 py-2.5 rounded-lg transition-colors ${sidebarRowClass(isActive)}`}
            >
              <Avatar size="md">#</Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">
                  #{displayName}
                </div>
                <div className="text-[12px] text-sidebar-sender truncate mt-0.5">
                  Участник
                </div>
                <div className="text-[12px] text-text-muted truncate mt-0.5">
                  {chat.lastMessage ?? "Текст последнего сообщения..."}
                </div>
              </div>
              {chat.badge !== undefined && chat.badge > 0 && (
                <div className="flex-shrink-0">
                  <Badge count={chat.badge} variant="unread" />
                </div>
              )}
            </Link>
          );
        }
        return (
          <DmChatRow
            key={`dm-${chat.slug}`}
            chat={chat}
            isActive={chat.slug === activeDmIdParam}
          />
        );
      })}
    </div>
  );
};
