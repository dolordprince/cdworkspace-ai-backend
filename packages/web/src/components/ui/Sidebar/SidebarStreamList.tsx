import React from "react";
import { Link } from "react-router-dom";
import { Icon } from "../Icon";
import { Avatar } from "../Avatar";
import { Badge } from "../Badge";
import { sidebarRowClass } from "../../../lib/format";
import { slugForStream, TOPIC_BAR_COLORS } from "./data";
import type { SidebarChat } from "./types";

interface SidebarStreamListProps {
  streamChats: SidebarChat[];
  activeStreamSlug: string | null;
  activeTopic?: string | null;
  expandedStreamSlug: string | null;
  onToggleStream: (slug: string) => void;
}

function isStream(
  chat: SidebarChat
): chat is Extract<SidebarChat, { type: "stream" }> {
  return chat.type === "stream";
}

export const SidebarStreamList: React.FC<SidebarStreamListProps> = ({
  streamChats,
  activeStreamSlug,
  activeTopic,
  expandedStreamSlug,
  onToggleStream,
}) => {
  const streams = streamChats.filter(isStream);

  return (
    <nav className="py-2 px-3">
      <div className="space-y-0.5">
        {streams.map((stream) => {
          const streamSlug = slugForStream(stream);
          const isActive = streamSlug === activeStreamSlug;
          const expanded = expandedStreamSlug === streamSlug;
          const isGeneral = stream.name.toLowerCase() === "general";
          const displayName = isGeneral ? "Общий чат" : stream.name;
          const topics = stream.topics ?? [];

          return (
            <div key={`stream-${stream.stream_id}`}>
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
                      {stream.lastMessage ?? "Текст последнего сообщения..."}
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
                  {stream.badge !== undefined && stream.badge > 0 && (
                    <Badge count={stream.badge} variant="unread" />
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
        })}
      </div>
    </nav>
  );
};
