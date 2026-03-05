import React, { useState, useMemo, useEffect } from "react";
import { Icon } from "../Icon";
import { ScrollArea } from "../ScrollArea";
import { SidebarActivity } from "./SidebarActivity";
import { SidebarFolderChatList } from "./SidebarFolderChatList";
import { SidebarStreamList } from "./SidebarStreamList";
import { getStreamChats, getChatsInFolder } from "./data";
import { useSidebarConfigStore } from "../../../stores/sidebarConfigStore";
import type { SidebarProps } from "./types";

export const Sidebar: React.FC<SidebarProps> = ({
  streams,
  selectedFolderId,
  activeStreamSlug = null,
  activeTopic = null,
  activeDmIdParam = null,
  sidebarDms,
  sidebarChats,
  onSelectStream,
  onSelectDm,
}) => {
  const { activityOpen, setActivityOpen } = useSidebarConfigStore();
  const [expandedStreamSlug, setExpandedStreamSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (activeTopic && activeStreamSlug) setExpandedStreamSlug(activeStreamSlug);
  }, [activeTopic, activeStreamSlug]);

  const streamChats = useMemo(() => getStreamChats(streams), [streams]);
  const chatsInFolder = useMemo(
    () => getChatsInFolder(selectedFolderId, streams, sidebarDms),
    [selectedFolderId, streams, sidebarDms]
  );

  const listChats = sidebarChats ?? chatsInFolder;

  const filterByQuery = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return () => true;
    return (chat: (typeof listChats)[number]) => {
      if (chat.type === "stream") {
        const nameMatch = chat.name.toLowerCase().includes(q);
        const topicMatch = chat.topics?.some((t) =>
          t.subject.toLowerCase().includes(q)
        );
        return nameMatch || (topicMatch ?? false);
      }
      return chat.name.toLowerCase().includes(q);
    };
  }, [searchQuery]);

  const filteredChats = useMemo(
    () => listChats.filter(filterByQuery),
    [listChats, filterByQuery]
  );

  const filteredStreamChats = useMemo(
    () => streamChats.filter(filterByQuery),
    [streamChats, filterByQuery]
  );

  return (
    <aside className="flex flex-col w-[300px] md:w-[340px] min-w-[280px] max-w-[380px] flex-shrink-0 min-h-0 bg-sidebar-bg rounded-[12px] overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <ScrollArea className="flex-1">
            <h2 className="px-3 pt-4 pb-2 text-sm font-medium text-text-primary">
              Чаты и каналы
            </h2>
            <div className="flex items-center gap-[8px] px-3 pb-3">
              <label className="flex-1 flex items-center min-w-0 h-8 opacity-100 rounded-lg border border-border-subtle bg-white/5 py-[2px] px-[8px] gap-2 text-text-muted focus-within:border-accent focus-within:text-text-primary">
                <input
                  type="search"
                  placeholder="Найти"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-0 h-full bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
                  aria-label="Поиск чатов и каналов"
                />
                <Icon name="search" size={28} className="shrink-0" />
              </label>
              <button
                type="button"
                className="flex items-center justify-center w-[34px] h-[34px] shrink-0 rounded-lg text-text-muted hover:bg-bg/60 hover:text-text-primary transition-colors"
                aria-label="Новое окно"
              >
                <Icon name="newWindow" size={34} />
              </button>
            </div>
            <SidebarActivity open={activityOpen} onToggle={() => setActivityOpen(!activityOpen)} />
            <div className="my-2">
              <div className="h-px bg-white/10" />
            </div>
            <SidebarFolderChatList
              chats={filteredChats}
              activeStreamSlug={activeStreamSlug}
              activeDmIdParam={activeDmIdParam}
              activeTopic={activeTopic}
              expandedStreamSlug={expandedStreamSlug}
              onToggleStream={(slug) => setExpandedStreamSlug((prev) => (prev === slug ? null : slug))}
            />
            {!sidebarChats && (
              <SidebarStreamList
                streamChats={filteredStreamChats}
                activeStreamSlug={activeStreamSlug}
                activeTopic={activeTopic}
                expandedStreamSlug={expandedStreamSlug}
                onToggleStream={(slug) => setExpandedStreamSlug((prev) => (prev === slug ? null : slug))}
              />
            )}
          </ScrollArea>

          <div className="flex-shrink-0 p-3 border-t border-border-subtle bg-sidebar-bg">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
            <Icon name="phone" size={18} className="text-green-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-text-primary truncate">
                Идёт звонок в «Название канала»
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">0:47</p>
            </div>
            <div className="flex -space-x-1.5 shrink-0">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full bg-bg-elevated border-2 border-bg-elevated"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
