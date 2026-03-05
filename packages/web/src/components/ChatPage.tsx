import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import {
  fetchMessages,
  fetchDmMessages,
  fetchUser,
  sendMessage,
  markMessagesAsRead,
  updateMessage,
  deleteMessage,
  addReaction,
  addMessageFlag,
  removeMessageFlag,
  type MockMessage,
} from "../lib/zulipClient";
import { getPresenceState, formatLastSeen } from "../lib/format";
import { stripHtml } from "../lib/html";
import { useOpenSearch } from "../contexts/OpenSearchContext";
import { useRightDrawer } from "../contexts/RightDrawerContext";
import { useThemeStore } from "../stores/themeStore";
import { useChatListStore } from "../stores/chatListStore";
import { useCurrentChatMessagesStore } from "../stores/currentChatMessagesStore";
import { useUsersStore } from "../stores/usersStore";
import { buildJitsiMeetingUrl } from "../lib/jitsi";
import { parseStreamSlug, parseDmSlugToUserIds } from "./ui/Sidebar/data";
import { ChatHeader } from "./ChatHeader";
import { JitsiCallModal } from "./JitsiCallModal";
import { MessageList, type MessageListCallbacks } from "./MessageList";
import { MessageComposer } from "./ui/MessageComposer";
import { Icon } from "./ui/Icon";
import type { StreamWithLast } from "./ui/Sidebar/data";

function EditMessageModalBody({
  initialContent,
  onSave,
  onClose,
}: {
  initialContent: string;
  onSave: (content: string) => void;
  onClose: () => void;
}) {
  const [content, setContent] = useState(initialContent);
  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <Dialog.Title className="text-sm font-semibold text-text-primary">Изменить сообщение</Dialog.Title>
        <Dialog.Close asChild>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-bg/50 text-text-muted" aria-label="Закрыть">
            <Icon name="close" size={18} />
          </button>
        </Dialog.Close>
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1 min-h-0">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 min-h-[120px] w-full rounded-lg border border-border-subtle bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none resize-none"
          placeholder="Текст сообщения"
        />
        <div className="flex justify-end gap-2">
          <Dialog.Close asChild>
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm text-text-muted hover:bg-bg/50">
              Отмена
            </button>
          </Dialog.Close>
          <button
            type="button"
            onClick={() => onSave(content)}
            className="px-3 py-1.5 rounded-lg text-sm bg-accent text-bg hover:opacity-90"
          >
            Сохранить
          </button>
        </div>
      </div>
    </>
  );
}

function ForwardMessageModalBody({
  streams,
  onForward,
  onClose,
}: {
  streams: StreamWithLast[];
  onForward: (stream: string, topic: string, to?: number[]) => void;
  onClose: () => void;
}) {
  const [selectedStream, setSelectedStream] = useState<string>("");
  const [topic, setTopic] = useState("general");
  const stream = streams.find((s) => s.name === selectedStream);
  const topics = stream?.topics?.map((t) => t.subject) ?? [];
  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <Dialog.Title className="text-sm font-semibold text-text-primary">Переслать в канал</Dialog.Title>
        <Dialog.Close asChild>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-bg/50 text-text-muted" aria-label="Закрыть">
            <Icon name="close" size={18} />
          </button>
        </Dialog.Close>
      </div>
      <div className="p-4 flex flex-col gap-3">
        <label className="text-sm text-text-muted">Канал</label>
        <select
          value={selectedStream}
          onChange={(e) => {
            setSelectedStream(e.target.value);
            setTopic("general");
          }}
          className="w-full rounded-lg border border-border-subtle bg-bg px-3 py-2 text-sm text-text-primary outline-none"
        >
          <option value="">Выберите канал</option>
          {streams.map((s) => (
            <option key={s.stream_id} value={s.name}>
              #{s.name}
            </option>
          ))}
        </select>
        <label className="text-sm text-text-muted">Тема</label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          list="forward-topics"
          className="w-full rounded-lg border border-border-subtle bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none"
          placeholder="general"
        />
        {topics.length > 0 && (
          <datalist id="forward-topics">
            {topics.map((subj) => (
              <option key={subj} value={subj} />
            ))}
          </datalist>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Dialog.Close asChild>
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm text-text-muted hover:bg-bg/50">
              Отмена
            </button>
          </Dialog.Close>
          <button
            type="button"
            disabled={!selectedStream}
            onClick={() => onForward(selectedStream, topic || "general")}
            className="px-3 py-1.5 rounded-lg text-sm bg-accent text-bg hover:opacity-90 disabled:opacity-50"
          >
            Переслать
          </button>
        </div>
      </div>
    </>
  );
}

export const ChatPage: React.FC = () => {
  const openSearch = useOpenSearch();
  const { streamSlug, topicName, dmId: dmIdParam } = useParams<{
    streamSlug?: string;
    topicName?: string;
    dmId?: string;
  }>();
  const activeTopic = topicName ?? undefined;
  const streamsMap = useChatListStore((s) => s.streamsMap);
  const parsedStream = streamSlug ? parseStreamSlug(streamSlug) : null;
  const activeStream =
    parsedStream?.stream_id != null
      ? streamsMap.get(parsedStream.stream_id)?.name ?? parsedStream.stream_name
      : parsedStream?.stream_name;
  const activeDmUserIds: number[] | null =
    dmIdParam == null || dmIdParam === "" ? null : parseDmSlugToUserIds(dmIdParam);
  const isDmView = activeDmUserIds !== null && activeDmUserIds.length > 0;
  const currentUserId = useChatListStore((s) => s.currentUserId);
  /** В 1-1 ЛС — id собеседника; в групповом — первый из списка для отображения в заголовке не используем */
  const partnerUserId =
    isDmView && activeDmUserIds?.length
      ? activeDmUserIds.length === 1
        ? activeDmUserIds[0]
        : activeDmUserIds.find((id) => id !== currentUserId) ?? activeDmUserIds[0]
      : null;
  const partnerUser = useUsersStore((s) =>
    partnerUserId != null ? s.getUser(partnerUserId) : undefined
  );

  // Подгрузка профиля собеседника в ЛС (аватар, имя, presence)
  useEffect(() => {
    if (!partnerUserId || !isDmView) return;
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
  }, [partnerUserId, isDmView]);

  const messages = useCurrentChatMessagesStore((s) => s.messages);
  const setContext = useCurrentChatMessagesStore((s) => s.setContext);
  const setMessagesInStore = useCurrentChatMessagesStore((s) => s.setMessages);
  const appendMessageToStore = useCurrentChatMessagesStore((s) => s.appendMessage);
  const removeMessageFromStore = useCurrentChatMessagesStore((s) => s.removeMessage);
  const removeMessagesFromStore = useCurrentChatMessagesStore((s) => s.removeMessages);
  const updateMessageFlagsInStore = useCurrentChatMessagesStore((s) => s.updateMessageFlags);
  const updateMessageReactionInStore = useCurrentChatMessagesStore((s) => s.updateMessageReaction);
  const updateMessageContentInStore = useCurrentChatMessagesStore((s) => s.updateMessageContent);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [replyQuote, setReplyQuote] = useState<{
    id: number;
    content: string;
    sender_full_name: string;
  } | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<number>>(new Set());
  const [editingMessage, setEditingMessage] = useState<MockMessage | null>(null);
  const [forwardMessage, setForwardMessage] = useState<MockMessage | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [jitsiModalUrl, setJitsiModalUrl] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const rightDrawer = useRightDrawer();
  const { themeId } = useThemeStore();

  useEffect(() => {
    if (toastMessage == null) return;
    const t = setTimeout(() => setToastMessage(null), 2000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
  }, [themeId]);

  // Загрузка только при открытии канала: зависимость только от URL (streamSlug, topicName)
  useEffect(() => {
    if (!streamSlug) {
      setContext(null);
      setMessagesLoading(false);
      return;
    }
    const parsed = parseStreamSlug(streamSlug);
    const streamName =
      parsed.stream_id != null
        ? streamsMap.get(parsed.stream_id)?.name ?? parsed.stream_name
        : parsed.stream_name;
    const streamId =
      parsed.stream_id ??
      (streamName ? Array.from(streamsMap.entries()).find(([, s]) => s.name === streamName)?.[0] : undefined);
    const topic = topicName ?? "general";
    if (streamName && streamId != null) {
      setContext({ type: "stream", streamId, streamName, topic });
      setMessagesLoading(true);
    } else {
      setContext(null);
    }
    if (!streamName) return;
    let cancelled = false;
    fetchMessages(streamName, topic === "general" ? undefined : topic)
      .then((m) => {
        if (!cancelled) {
          for (const msg of m) {
            useUsersStore.getState().mergeUser({
              user_id: msg.sender_id,
              full_name: msg.sender_full_name ?? "",
            });
          }
          setMessagesInStore(m);
          const unreadIds = m.filter((msg) => !msg.flags?.includes("read")).map((msg) => msg.id);
          if (unreadIds.length > 0) markMessagesAsRead(unreadIds).catch(() => {});
          setMessagesLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setMessagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [streamSlug, topicName, streamsMap, setContext, setMessagesInStore]);

  // Загрузка только при открытии ЛС: зависимость от dmIdParam (строка), не от массива activeDmUserIds
  useEffect(() => {
    if (!dmIdParam || dmIdParam === "") {
      if (!streamSlug) setContext(null);
      return;
    }
    const userIds = parseDmSlugToUserIds(dmIdParam);
    if (userIds.length === 0) return;
    const dmKey =
      currentUserId != null && userIds.length === 1
        ? [currentUserId, userIds[0]].sort((a, b) => a - b).join(",")
        : [...userIds].sort((a, b) => a - b).join(",");
    setContext({ type: "dm", dmKey });
    setMessagesLoading(true);
    let cancelled = false;
    const id = userIds.length === 1 ? userIds[0] : userIds;
    fetchDmMessages(id)
      .then((m) => {
        if (!cancelled) {
          for (const msg of m) {
            useUsersStore.getState().mergeUser({
              user_id: msg.sender_id,
              full_name: msg.sender_full_name ?? "",
            });
          }
          setMessagesInStore(m);
          const unreadIds = m.filter((msg) => !msg.flags?.includes("read")).map((msg) => msg.id);
          if (unreadIds.length > 0) markMessagesAsRead(unreadIds).catch(() => {});
          setMessagesLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setMessagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dmIdParam, currentUserId, setContext, setMessagesInStore]);

  const handleCallClick = useCallback(async () => {
    if (!isDmView || !activeDmUserIds?.length) return;
    setSendError(null);
    setSending(true);
    try {
      const sortedIds = [...activeDmUserIds, currentUserId ?? 0]
        .filter((id, i, arr) => arr.indexOf(id) === i)
        .sort((a, b) => a - b);
      const roomName = `zulip-dm-${sortedIds.join("-")}-${Date.now()}`;
      const url = buildJitsiMeetingUrl(roomName);
      const newMsg = await sendMessage({
        to: activeDmUserIds,
        content: url,
        sender_full_name: "Вы",
      });
      appendMessageToStore(newMsg);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Не удалось создать звонок");
    } finally {
      setSending(false);
    }
  }, [isDmView, activeDmUserIds, currentUserId]);

  const handleSend = async (content: string, subjectOverride?: string) => {
    setSendError(null);
    if (isDmView && activeDmUserIds?.length) {
      setSending(true);
      try {
        const newMsg = await sendMessage({
          to: activeDmUserIds,
          content,
          sender_full_name: "Вы",
        });
        appendMessageToStore(newMsg);
        setReplyQuote(null);
      } catch (err) {
        setSendError(err instanceof Error ? err.message : "Не удалось отправить сообщение");
      } finally {
        setSending(false);
      }
      return;
    }
    if (activeStream) {
      const subject = subjectOverride ?? activeTopic ?? "general";
      setSending(true);
      try {
        const newMsg = await sendMessage({
          stream: activeStream,
          subject,
          content,
          sender_id: currentUserId ?? 0,
          sender_full_name: "Вы",
        });
        appendMessageToStore(newMsg);
        setReplyQuote(null);
      } catch (err) {
        setSendError(err instanceof Error ? err.message : "Не удалось отправить сообщение");
      } finally {
        setSending(false);
      }
    }
  };

  const messageCallbacks: MessageListCallbacks = useMemo(
    () => ({
      onMessageReply(msg) {
        setReplyQuote({
          id: msg.id,
          content: msg.content,
          sender_full_name: msg.sender_full_name,
        });
      },
      onMessageEdit(msg) {
        setEditingMessage(msg);
      },
      onMessageDelete(msg) {
        if (!window.confirm("Удалить сообщение?")) return;
        setActionError(null);
        deleteMessage(msg.id)
          .then(() => {
            removeMessageFromStore(msg.id);
          })
          .catch((err) => setActionError(err instanceof Error ? err.message : "Ошибка удаления"));
      },
      onMessageCopy(msg) {
        const text = stripHtml(msg.content);
        navigator.clipboard.writeText(text).then(
          () => setToastMessage("Скопировано"),
          () => setToastMessage("Не удалось скопировать")
        );
      },
      onMessageForward(msg) {
        setForwardMessage(msg);
      },
      onMessageStar(msg) {
        const hasStar = msg.flags?.includes("starred");
        setActionError(null);
        (hasStar ? removeMessageFlag([msg.id], "starred") : addMessageFlag([msg.id], "starred"))
          .then(() => {
            updateMessageFlagsInStore([msg.id], "starred", hasStar ? "remove" : "add");
          })
          .catch((err) => setActionError(err instanceof Error ? err.message : "Ошибка"));
      },
      onMessageSelect(msg) {
        setSelectedMessageIds((prev) => {
          const next = new Set(prev);
          if (next.has(msg.id)) next.delete(msg.id);
          else next.add(msg.id);
          return next;
        });
        if (!selectionMode) setSelectionMode(true);
      },
      onMessageAddReaction(messageId, emojiName) {
        setActionError(null);
        addReaction(messageId, emojiName)
          .then(() => {
            updateMessageReactionInStore(
              messageId,
              {
                emoji_name: emojiName,
                emoji_code: "",
                reaction_type: "unicode_emoji",
                user_id: currentUserId ?? 0,
              },
              "add"
            );
          })
          .catch((err) => setActionError(err instanceof Error ? err.message : "Ошибка реакции"));
      },
      onOpenJitsiCall(url: string) {
        setJitsiModalUrl(url);
      },
      onStub() {
        setToastMessage("Функция недоступна");
      },
    }),
    [selectionMode, currentUserId, removeMessageFromStore, updateMessageFlagsInStore, updateMessageReactionInStore]
  );

  const handleSaveEdit = useCallback(
    (content: string) => {
      if (!editingMessage) return;
      setActionError(null);
      updateMessage(editingMessage.id, { content })
        .then(() => {
          updateMessageContentInStore(editingMessage.id, content);
          setEditingMessage(null);
        })
        .catch((err) => setActionError(err instanceof Error ? err.message : "Ошибка сохранения"));
    },
    [editingMessage, updateMessageContentInStore]
  );

  const handleForwardTo = useCallback(
    (stream: string, topic: string, to?: number[]) => {
      if (!forwardMessage) return;
      setSendError(null);
      const quoted = `> **${forwardMessage.sender_full_name}:**\n\n${forwardMessage.content}\n\n`;
      if (to != null && to.length > 0) {
        sendMessage({ to, content: quoted, sender_full_name: "Вы" })
          .then(() => setForwardMessage(null))
          .catch((err) => setSendError(err instanceof Error ? err.message : "Ошибка пересылки"));
      } else {
        sendMessage({
          stream,
          subject: topic,
          content: quoted,
          sender_full_name: "Вы",
        })
          .then(() => setForwardMessage(null))
          .catch((err) => setSendError(err instanceof Error ? err.message : "Ошибка пересылки"));
      }
    },
    [forwardMessage]
  );

  const streams = useChatListStore((s) => s.streams());

  return (
    <div className="flex-1 min-w-0 min-h-0 max-w-[1199px] max-h-full flex flex-col overflow-hidden">
      {/* Модалка редактирования сообщения */}
      <Dialog.Root open={!!editingMessage} onOpenChange={(open) => !open && setEditingMessage(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg rounded-xl bg-bg-elevated border border-border-subtle shadow-xl flex flex-col max-h-[80vh] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {editingMessage && (
              <EditMessageModalBody
                initialContent={editingMessage.content}
                onSave={handleSaveEdit}
                onClose={() => setEditingMessage(null)}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Модалка пересылки */}
      <Dialog.Root open={!!forwardMessage} onOpenChange={(open) => !open && setForwardMessage(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-xl bg-bg-elevated border border-border-subtle shadow-xl flex flex-col max-h-[70vh] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {forwardMessage && (
              <ForwardMessageModalBody
                streams={streams}
                onForward={handleForwardTo}
                onClose={() => setForwardMessage(null)}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ChatHeader
        channelName={
          activeStream ? `#${activeStream}` : "Название канала"
        }
        participantsCount={5}
        onlineCount={2}
        onOpenSearch={openSearch ?? undefined}
        onToggleRightPanel={rightDrawer ? () => rightDrawer.setOpen(!rightDrawer.open) : undefined}
        rightPanelOpen={rightDrawer?.open ?? false}
        rightPanelLabel={isDmView ? "Информация о собеседнике" : undefined}
        hideTopic
        hideParticipants={isDmView}
        onCallClick={isDmView && (activeDmUserIds?.length ?? 0) > 0 ? handleCallClick : undefined}
        dmPartner={
          isDmView && partnerUserId != null
            ? {
                avatarUrl: partnerUser?.avatar_url ?? undefined,
                name: partnerUser?.full_name?.trim() || "Собеседник",
                presenceState:
                  partnerUser?.presence != null
                    ? getPresenceState(
                        partnerUser.presence.timestamp,
                        partnerUser.presence.status
                      )
                    : null,
                lastSeen:
                  partnerUser?.presence != null
                    ? formatLastSeen(
                        partnerUser.presence.timestamp,
                        partnerUser.presence.status
                      )
                    : undefined,
              }
            : undefined
        }
      />
      <section className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {messagesLoading ? (
          <div className="flex flex-1 items-center justify-center min-h-[200px]" aria-busy="true" aria-label="Загрузка сообщений">
            <div className="w-8 h-8 rounded-full border-2 border-border-subtle border-t-accent animate-spin" />
          </div>
        ) : isDmView ? (
          <MessageList
            messages={messages}
            currentUserId={currentUserId ?? undefined}
            scrollToBottomKey={activeDmUserIds !== null ? `dm-${activeDmUserIds.join(",")}` : undefined}
            callbacks={messageCallbacks}
            selectionMode={selectionMode}
            selectedMessageIds={selectedMessageIds}
          />
        ) : (
          <MessageList
            messages={messages}
            currentUserId={currentUserId ?? undefined}
            scrollToBottomKey={[activeStream ?? "", activeTopic ?? ""].join("|")}
            callbacks={messageCallbacks}
            selectionMode={selectionMode}
            selectedMessageIds={selectedMessageIds}
          />
        )}
        {selectionMode && selectedMessageIds.size > 0 && (
          <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-t border-border-subtle bg-bg-elevated">
            <span className="text-sm text-text-muted">
              Выбрано: {selectedMessageIds.size}
            </span>
            <button
              type="button"
              className="text-sm text-red-500 hover:underline"
              onClick={() => {
                if (!window.confirm(`Удалить ${selectedMessageIds.size} сообщений?`)) return;
                Promise.all(Array.from(selectedMessageIds).map((id) => deleteMessage(id)))
                  .then(() => {
                    removeMessagesFromStore(Array.from(selectedMessageIds));
                    setSelectedMessageIds(new Set());
                    setSelectionMode(false);
                  })
                  .catch((err) => setActionError(err instanceof Error ? err.message : "Ошибка"));
              }}
            >
              Удалить выбранные
            </button>
            <button
              type="button"
              className="text-sm text-text-primary hover:underline"
              onClick={() => {
                const first = messages.find((m) => selectedMessageIds.has(m.id));
                if (first) setForwardMessage(first);
              }}
            >
              Переслать выбранные
            </button>
            <button
              type="button"
              className="text-sm text-text-muted hover:underline"
              onClick={() => {
                setSelectedMessageIds(new Set());
                setSelectionMode(false);
              }}
            >
              Отмена
            </button>
          </div>
        )}
        {actionError && (
          <div className="flex-shrink-0 px-4 py-2 text-sm text-red-500 bg-red-500/10 border-t border-border-subtle" role="alert">
            {actionError}
          </div>
        )}
        {sendError && (
          <div className="flex-shrink-0 px-4 py-2 text-sm text-red-500 bg-red-500/10 border-t border-border-subtle" role="alert">
            {sendError}
          </div>
        )}
        {toastMessage && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-bg-elevated border border-border-subtle text-sm text-text-primary shadow-lg z-50">
            {toastMessage}
          </div>
        )}
        <MessageComposer
          onSend={handleSend}
          disabled={sending || (isDmView ? !(activeDmUserIds?.length) : !activeStream)}
          placeholder={
            isDmView
              ? activeDmUserIds?.length
                ? "Написать сообщение..."
                : "Выберите чат"
              : activeStream
                ? "Написать сообщение..."
                : "Выберите канал для отправки сообщений"
          }
          activeTopic={activeTopic ?? undefined}
          replyQuote={replyQuote}
          onClearReply={() => setReplyQuote(null)}
        />
      </section>
      {jitsiModalUrl && (
        <JitsiCallModal
          open={!!jitsiModalUrl}
          meetingUrl={jitsiModalUrl}
          onClose={() => setJitsiModalUrl(null)}
        />
      )}
    </div>
  );
};
