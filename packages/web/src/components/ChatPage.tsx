import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  fetchMessages,
  fetchDmMessages,
  sendMessage,
  type MockMessage,
} from "../lib/zulipClient";
import { useOpenSearch } from "../contexts/OpenSearchContext";
import { useRightDrawer } from "../contexts/RightDrawerContext";
import { useThemeStore } from "../stores/themeStore";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./ui/MessageComposer";

export const ChatPage: React.FC = () => {
  const openSearch = useOpenSearch();
  const { streamName, topicName, dmId: dmIdParam } = useParams<{
    streamName?: string;
    topicName?: string;
    dmId?: string;
  }>();
  const activeStream = streamName ?? undefined;
  const activeTopic = topicName ?? undefined;
  const activeDmId = dmIdParam ? parseInt(dmIdParam, 10) : null;
  const isDmView = activeDmId !== null && !Number.isNaN(activeDmId);

  const [messages, setMessages] = useState<MockMessage[]>([]);
  const [sending, setSending] = useState(false);
  const rightDrawer = useRightDrawer();
  const { themeId } = useThemeStore();

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
  }, [themeId]);

  useEffect(() => {
    if (!activeStream) return;
    let cancelled = false;
    const loadFull = async () => {
      const m = await fetchMessages(activeStream, activeTopic);
      if (!cancelled) setMessages(m);
    };
    void loadFull();
    const POLL_INTERVAL_MS = 10_000;
    const pollMessages = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const m = await fetchMessages(activeStream, activeTopic);
      if (!cancelled) setMessages(m);
    };
    const intervalId = setInterval(pollMessages, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [activeStream, activeTopic]);

  useEffect(() => {
    if (!isDmView || activeDmId === null) return;
    let cancelled = false;
    fetchDmMessages(activeDmId).then((m) => {
      if (!cancelled) setMessages(m);
    });
    return () => {
      cancelled = true;
    };
  }, [isDmView, activeDmId]);

  const handleSend = async (content: string, subjectOverride?: string) => {
    if (!activeStream) return;
    const subject = subjectOverride ?? activeTopic ?? "general";
    setSending(true);
    try {
      const newMsg = await sendMessage({
        stream: activeStream,
        subject,
        content,
        sender_id: 999,
        sender_full_name: "Вы",
      });
      setMessages((prev) => [...prev, newMsg]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 min-w-0 min-h-0 max-w-[1199px] max-h-full flex flex-col overflow-hidden">
      <ChatHeader
        channelName={
          isDmView
            ? "Личный диалог"
            : activeStream
              ? `#${activeStream}`
              : "Название канала"
        }
        participantsCount={5}
        onlineCount={2}
        onOpenSearch={openSearch ?? undefined}
        onToggleRightPanel={rightDrawer ? () => rightDrawer.setOpen(!rightDrawer.open) : undefined}
        rightPanelOpen={rightDrawer?.open ?? false}
        rightPanelLabel={isDmView ? "Информация о собеседнике" : undefined}
        hideTopic
        hideParticipants={isDmView}
      />
      <section className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {isDmView ? (
          <MessageList
            messages={messages}
            currentUserId={999}
            scrollToBottomKey={activeDmId !== null ? `dm-${activeDmId}` : undefined}
          />
        ) : (
          <MessageList
            messages={messages}
            currentUserId={999}
            scrollToBottomKey={[activeStream ?? "", activeTopic ?? ""].join("|")}
          />
        )}
        <MessageComposer
          onSend={handleSend}
          disabled={isDmView || !activeStream || sending}
          placeholder={
            isDmView
              ? "Личные сообщения — скоро"
              : activeStream
                ? "Написать сообщение..."
                : "Выберите канал для отправки сообщений"
          }
          activeTopic={activeTopic ?? undefined}
        />
      </section>
    </div>
  );
};
