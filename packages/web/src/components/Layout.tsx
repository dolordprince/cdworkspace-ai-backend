import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation, Outlet } from "react-router-dom";
import { useInstancesStore } from "../stores/instancesStore";
import { useChatListStore } from "../stores/chatListStore";
import { useCurrentChatMessagesStore } from "../stores/currentChatMessagesStore";
import { useUsersStore } from "../stores/usersStore";
import {
  fetchRecentMessages,
  fetchUsers,
  fetchRealmPresence,
  fetchUser,
  getCurrentUser,
  rawMessageToMockMessage,
  type MockMessage,
  type MockFolder,
  type ZulipRawMessage,
  type ZulipEvent,
} from "../lib/zulipClient";
import { startZulipEventLoop } from "../lib/zulipRealtime";
import { isMessageForContext } from "../stores/currentChatMessagesStore";
import { formatLastSeen } from "../lib/format";
import { getFolders, mapWorkspaceFoldersToRail } from "../lib/api/workspaceClient";
import { parseStreamSlug, slugForStream } from "./ui/Sidebar/data";
import { Sidebar } from "./ui/Sidebar";
import { FolderRail } from "./ui/FolderRail";
import { RightDrawer } from "./ui/RightDrawer";
import { RightPanel, type RightPanelUserInfo } from "./ui/RightPanel";
import { getDmById } from "./ui/Sidebar/data";
import { TopBar, type TopBarSection } from "./ui/TopBar";
import { InstanceSwitcher } from "./InstanceSwitcher";
import { SearchModal } from "./SearchModal";
import { ProfileDrawer } from "./ProfileDrawer";
import { OpenSearchContext } from "../contexts/OpenSearchContext";
import { RightDrawerContext } from "../contexts/RightDrawerContext";

function getSectionFromPathname(pathname: string): TopBarSection {
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/mail")) return "mail";
  if (pathname.startsWith("/calls")) return "calls";
  return "chat";
}

export const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentInstanceId = useInstancesStore((s) => s.currentInstanceId);
  const { streamSlug, topicName, dmId: dmIdParam } = useParams<{
    streamSlug?: string;
    topicName?: string;
    dmId?: string;
  }>();
  const activeStreamSlug = streamSlug ?? undefined;
  const activeTopic = topicName ?? null;

  const setFromMessages = useChatListStore((s) => s.setFromMessages);
  const setCurrentUserId = useChatListStore((s) => s.setCurrentUserId);
  const streamsFromStore = useChatListStore((s) => s.streams());
  const dmsFromStore = useChatListStore((s) => s.dms());
  const chatsSortedByLastMessage = useChatListStore((s) => s.chatsSortedByLastMessage());
  const streamsMap = useChatListStore((s) => s.streamsMap);

  const [folders, setFolders] = useState<MockFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("1");
  const [searchOpen, setSearchOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [currentUserStatus, setCurrentUserStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const eventLoopAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (folders.length > 0 && !folders.some((f) => f.id === selectedFolderId)) {
      setSelectedFolderId(folders[0].id);
    }
  }, [folders, selectedFolderId]);
  const openSearch = React.useCallback(() => setSearchOpen(true), []);

  // Текущий пользователь — предусловие для UI; пользователи и сообщения грузятся параллельно
  useEffect(() => {
    if (!currentInstanceId) return;
    let cancelled = false;
    setCurrentUserStatus("loading");
    useUsersStore.getState().clear();
    useChatListStore.getState().clear();
    useCurrentChatMessagesStore.getState().setContext(null);
    useCurrentChatMessagesStore.getState().setMessages([]);

    const pUsers = fetchUsers();
    const pMessages = fetchRecentMessages();

    getCurrentUser()
      .then((user) => {
        if (cancelled) return;
        if (user?.user_id != null) {
          useUsersStore.getState().mergeUser(user);
          setCurrentUserId(user.user_id);
          setCurrentUserStatus("ready");
        } else {
          setCurrentUserStatus("error");
          useUsersStore.getState().clear();
          useChatListStore.getState().clear();
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentUserStatus("error");
          useUsersStore.getState().clear();
          useChatListStore.getState().clear();
        }
      });

    Promise.all([pUsers, pMessages])
      .then(([members, messages]) => {
        if (cancelled) return;
        const msgs = messages ?? [];
        useUsersStore.getState().mergeUsers(members ?? []);
        for (const m of msgs) {
          useUsersStore.getState().mergeFromMessage(m);
        }
        const uid = useChatListStore.getState().currentUserId ?? null;
        setFromMessages(msgs, uid);

        eventLoopAbortRef.current?.abort();
        eventLoopAbortRef.current = new AbortController();
        startZulipEventLoop({
          signal: eventLoopAbortRef.current.signal,
          onEvent(event: ZulipEvent) {
            const chatList = useChatListStore.getState();
            const currentChat = useCurrentChatMessagesStore.getState();
            const currentUserId = chatList.currentUserId;

            if (event.type === "message" && event.message) {
              const raw = event.message as unknown as ZulipRawMessage;
              useUsersStore.getState().mergeFromMessage(raw);
              chatList.addMessage(raw);
              if (currentChat.context && isMessageForContext(raw, currentChat.context, currentUserId)) {
                currentChat.appendMessage(rawMessageToMockMessage(raw));
              }
            } else if (event.type === "update_message_flags") {
              const op = event.op as "add" | "remove";
              const flag = event.flag as string;
              const messageIds = (event.messages ?? []) as number[];
              if (messageIds.length === 0) return;
              if (flag === "read") {
                if (op === "add") {
                  chatList.decrementUnreadForMessages(messageIds);
                  currentChat.updateMessageFlags(messageIds, "read", "add");
                } else {
                  chatList.incrementUnreadForMessages(messageIds);
                  currentChat.updateMessageFlags(messageIds, "read", "remove");
                }
              }
            } else if (event.type === "reaction") {
              const messageId = event.message_id as number;
              const reaction = event.emoji_name != null
                ? {
                    emoji_name: event.emoji_name as string,
                    emoji_code: (event.emoji_code as string) ?? "",
                    reaction_type: (event.reaction_type as "unicode_emoji" | "realm_emoji" | "zulip_extra_emoji") ?? "unicode_emoji",
                    user_id: event.user_id as number,
                  }
                : null;
              if (reaction) {
                const op = (event.op as "add" | "remove") ?? "add";
                currentChat.updateMessageReaction(messageId, reaction, op);
              }
            } else if (event.type === "delete_message") {
              const messageIds = event.message_ids
                ? (event.message_ids as number[])
                : event.message_id != null
                  ? [event.message_id as number]
                  : [];
              if (messageIds.length > 0) {
                chatList.handleDeleteMessages(messageIds);
                currentChat.removeMessages(messageIds);
              }
            }
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          // Не сбрасываем сторы — текущий пользователь уже мог загрузиться
        }
      });

    return () => {
      cancelled = true;
      eventLoopAbortRef.current?.abort();
      eventLoopAbortRef.current = null;
    };
  }, [currentInstanceId, setFromMessages, setCurrentUserId]);

  const showFullscreenLoader =
    currentInstanceId != null &&
    (currentUserStatus === "loading" || currentUserStatus === "idle");
  const showError = currentInstanceId != null && currentUserStatus === "error";

  // Если открыт legacy URL /stream/general без stream_id — редирект на slug первого канала при наличии данных
  useEffect(() => {
    if (!activeStreamSlug || streamsFromStore.length === 0) return;
    const parsed = parseStreamSlug(activeStreamSlug);
    if (parsed.stream_id != null) return;
    const first = streamsFromStore[0];
    if (first) navigate(`/stream/${slugForStream(first)}`, { replace: true });
  }, [activeStreamSlug, streamsFromStore, navigate]);

  useEffect(() => {
    if (!currentInstanceId || currentUserStatus !== "ready") return;
    let cancelled = false;
    getFolders()
      .then((f) => {
        if (!cancelled) setFolders(mapWorkspaceFoldersToRail(f));
      })
      .catch(() => {
        if (!cancelled) setFolders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentInstanceId, currentUserStatus]);

  // Периодический опрос presence (онлайн) и обновление usersStore
  const PRESENCE_POLL_MS = 90_000;
  useEffect(() => {
    if (!currentInstanceId || currentUserStatus !== "ready") return;
    let cancelled = false;
    const applyPresence = () => {
      if (cancelled) return;
      fetchRealmPresence().then((data) => {
        if (cancelled || data.result === "error" || !data.presences) return;
        const store = useUsersStore.getState();
        for (const [email, entry] of Object.entries(data.presences)) {
          const agg = entry.aggregated ?? entry.website;
          if (agg?.status != null && agg?.timestamp != null) {
            store.setPresenceByEmail(email, {
              status: agg.status === "idle" ? "idle" : "active",
              timestamp: agg.timestamp,
            });
          }
        }
      });
    };
    applyPresence();
    const interval = setInterval(applyPresence, PRESENCE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentInstanceId, currentUserStatus]);

  const handleSelectStream = (slug?: string) => {
    if (slug) navigate(`/stream/${slug}`);
    else navigate("/");
  };

  const handleSelectDm = (slug: string | null) => {
    if (slug) navigate(`/dm/${slug}`);
    else navigate("/");
  };

  const handleSearchSelectMessage = (msg: MockMessage) => {
    const streamName = msg.channel ?? "general";
    const topic = msg.subject ?? "general";
    const stream = streamsFromStore.find((s) => s.name === streamName);
    const slug = stream ? slugForStream(stream) : streamName;
    navigate(`/stream/${slug}/topic/${encodeURIComponent(topic)}`);
  };

  const activeSection = getSectionFromPathname(location.pathname);
  const handleSectionChange = (section: TopBarSection) => {
    if (section === "chat") {
      const first = streamsFromStore[0];
      navigate(first ? `/stream/${slugForStream(first)}` : "/");
    } else {
      navigate(`/${section}`);
    }
  };

  const parsedStream = activeStreamSlug ? parseStreamSlug(activeStreamSlug) : null;
  const activeStreamName = parsedStream?.stream_id != null ? streamsMap.get(parsedStream.stream_id)?.name ?? parsedStream.stream_name : parsedStream?.stream_name;
  const rightDrawerTitle =
    dmIdParam != null && dmIdParam !== ""
      ? "Личный диалог"
      : activeStreamName
        ? `#${activeStreamName}`
        : "Название чата";

  const dmChat =
    dmIdParam != null && dmIdParam !== ""
      ? getDmById(dmIdParam, dmsFromStore)
      : undefined;
  const partnerUserId =
    dmChat && !dmChat.isGroup ? dmChat.id : undefined;

  // Подгрузка профиля при открытии правой панели для ЛС
  useEffect(() => {
    if (!partnerUserId || !rightDrawerOpen) return;
    let cancelled = false;
    fetchUser(partnerUserId)
      .then((user) => {
        if (!cancelled && user)
          useUsersStore.getState().mergeUser({
            user_id: user.user_id,
            full_name: user.full_name ?? "",
            email: user.email,
            avatar_url: user.avatar_url ?? undefined,
          });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [partnerUserId, rightDrawerOpen]);

  const userFromStore = useUsersStore((s) =>
    partnerUserId != null ? s.getUser(partnerUserId) : undefined
  );
  const rightPanelUser: RightPanelUserInfo | undefined =
    userFromStore != null
      ? {
          name: userFromStore.full_name?.trim() || dmChat?.name || "",
          lastSeen: userFromStore.presence
            ? formatLastSeen(
                userFromStore.presence.timestamp,
                userFromStore.presence.status
              )
            : undefined,
          avatarUrl: userFromStore.avatar_url ?? undefined,
        }
      : dmChat
        ? { name: dmChat.name, lastSeen: undefined }
        : undefined;

  if (showFullscreenLoader) {
    return (
      <div className="h-screen min-h-[400px] max-h-[100dvh] bg-bg text-text-primary flex items-center justify-center">
        <p className="text-text-muted text-sm">Загрузка…</p>
      </div>
    );
  }

  if (showError) {
    return (
      <div className="h-screen min-h-[400px] max-h-[100dvh] bg-bg text-text-primary flex items-center justify-center">
        <p className="text-text-muted text-sm">Не удалось загрузить профиль</p>
      </div>
    );
  }

  return (
    <OpenSearchContext.Provider value={openSearch}>
      <RightDrawerContext.Provider
        value={{ open: rightDrawerOpen, setOpen: setRightDrawerOpen }}
      >
        <div className="h-screen min-h-[400px] max-h-[100dvh] bg-bg text-text-primary flex flex-col items-stretch overflow-hidden">
          <SearchModal
            open={searchOpen}
            onOpenChange={setSearchOpen}
            onSelectMessage={handleSearchSelectMessage}
          />
          <ProfileDrawer open={profileDrawerOpen} onOpenChange={setProfileDrawerOpen} />
          <TopBar
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            onOpenSearch={openSearch}
            onOpenProfile={() => setProfileDrawerOpen(true)}
            leftContent={<InstanceSwitcher />}
          />
          <div className="flex-1 flex min-h-0 items-stretch justify-center">
            <div className="w-full max-w-[1920px] flex min-h-0 min-w-0 gap-1">
              {activeSection === "chat" && (
                <>
                  <FolderRail
                    folders={folders}
                    selectedFolderId={selectedFolderId}
                    onSelectFolder={setSelectedFolderId}
                  />
                  <Sidebar
                    streams={streamsFromStore}
                    selectedFolderId={selectedFolderId}
                    activeStreamSlug={activeStreamSlug ?? null}
                    activeTopic={activeTopic}
                    activeDmIdParam={dmIdParam ?? null}
                    sidebarDms={dmsFromStore}
                    sidebarChats={chatsSortedByLastMessage}
                    onSelectStream={handleSelectStream}
                    onSelectDm={handleSelectDm}
                  />
                </>
              )}
              <main className="flex-1 flex min-h-0 min-w-0 items-stretch justify-start overflow-hidden">
                <Outlet />
              </main>
              {activeSection === "chat" && rightDrawerOpen && (
                <RightDrawer onClose={() => setRightDrawerOpen(false)}>
                  <RightPanel
                    title={rightDrawerTitle}
                    participantsCount={5}
                    onlineCount={2}
                    user={rightPanelUser}
                  />
                </RightDrawer>
              )}
            </div>
          </div>
        </div>
      </RightDrawerContext.Provider>
    </OpenSearchContext.Provider>
  );
};
