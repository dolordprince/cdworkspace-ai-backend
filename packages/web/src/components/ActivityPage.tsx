import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchActivityMessages, type ZulipRawMessage, type ActivityFilter } from "../lib/zulipClient";
import { useChatListStore } from "../stores/chatListStore";
import { useUsersStore } from "../stores/usersStore";
import { useOpenSearch } from "../contexts/OpenSearchContext";
import {
  slugForStream,
  messageToDmEntry,
  MY_ACTIVITY,
} from "./ui/Sidebar/data";
import { ChatHeader } from "./ChatHeader";
import { formatMessageTime } from "../lib/format";

const ACTIVITY_FILTERS: ActivityFilter[] = ["starred", "mentions", "reactions"];

function getActivityTitle(filter: ActivityFilter): string {
  const item = MY_ACTIVITY.find(
    (i) =>
      (filter === "starred" && i.key === "favorites") ||
      (filter === "mentions" && i.key === "mentions") ||
      (filter === "reactions" && i.key === "reactions")
  );
  return item?.label ?? filter;
}

function stripHtml(html: string): string {
  const plain = html.replace(/<[^>]+>/g, "").trim();
  const max = 80;
  if (plain.length <= max) return plain;
  return plain.slice(0, max) + "…";
}

function formatItemTime(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) return formatMessageTime(ts);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth()
  )
    return "Вчера " + formatMessageTime(ts);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function ActivitySenderName({ senderId, fallback }: { senderId: number; fallback: string }) {
  const displayName = useUsersStore((s) => s.getDisplayName(senderId));
  return <>{displayName !== "Unknown" ? displayName : fallback}</>;
}

export const ActivityPage: React.FC = () => {
  const { filter } = useParams<{ filter: string }>();
  const navigate = useNavigate();
  const openSearch = useOpenSearch();
  const currentUserId = useChatListStore((s) => s.currentUserId ?? null);
  const [messages, setMessages] = useState<ZulipRawMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const listScrollRef = useRef<HTMLUListElement>(null);

  const validFilter =
    filter && ACTIVITY_FILTERS.includes(filter as ActivityFilter)
      ? (filter as ActivityFilter)
      : null;

  useEffect(() => {
    if (!validFilter) {
      navigate("/activity/mentions", { replace: true });
      return;
    }
    setLoading(true);
    let cancelled = false;
    fetchActivityMessages(validFilter, currentUserId)
      .then((list) => {
        if (!cancelled) {
          for (const m of list) useUsersStore.getState().mergeFromMessage(m);
          setMessages(list);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [validFilter, currentUserId, navigate]);

  // Прокрутка вниз при открытии/смене фильтра после загрузки сообщений
  useEffect(() => {
    if (loading || messages.length === 0) return;
    const el = listScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [loading, messages.length, validFilter]);

  const handleMessageClick = (m: ZulipRawMessage) => {
    if (m.type === "stream" && m.stream_id != null) {
      const name =
        typeof m.display_recipient === "string"
          ? m.display_recipient
          : String(m.stream_id);
      const slug = slugForStream({ stream_id: m.stream_id, name });
      const topic = (m.subject ?? "").trim() || "general";
      navigate(
        `/stream/${slug}/topic/${encodeURIComponent(topic)}`
      );
      return;
    }
    if (m.type === "private" && Array.isArray(m.display_recipient)) {
      const entry = messageToDmEntry(m, currentUserId);
      if (entry) navigate(`/dm/${entry.slug}`);
    }
  };

  if (!validFilter) return null;

  const title = getActivityTitle(validFilter);

  return (
    <div className="flex-1 min-w-0 min-h-0 max-w-[1199px] max-h-full flex flex-col overflow-hidden">
      <ChatHeader
        channelName={title}
        hideTopic
        hideParticipants
        onOpenSearch={openSearch ?? undefined}
      />
      <section className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="p-4 text-text-muted text-sm">Загрузка…</div>
        ) : messages.length === 0 ? (
          <div className="p-4 text-text-muted text-sm">Нет сообщений</div>
        ) : (
          <ul
            ref={listScrollRef}
            className="flex flex-col overflow-auto p-2 space-y-1"
          >
            {messages.map((m) => {
              const isStream = m.type === "stream" && m.stream_id != null;
              const streamName =
                isStream && typeof m.display_recipient === "string"
                  ? m.display_recipient
                  : null;
              const topic = isStream ? (m.subject ?? "").trim() || "general" : null;
              let dmName: string | null = null;
              if (m.type === "private" && Array.isArray(m.display_recipient)) {
                const entry = messageToDmEntry(m, currentUserId);
                dmName = entry?.name ?? null;
              }
              const context = isStream
                ? `#${streamName} · ${topic}`
                : dmName
                  ? `Личное · ${dmName}`
                  : "Личное";

              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => handleMessageClick(m)}
                    className="w-full text-left p-3 rounded-lg hover:bg-[#333333] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] text-text-muted shrink-0">
                        {formatItemTime(m.timestamp)}
                      </span>
                      <span className="text-[11px] text-text-muted truncate">
                        {context}
                      </span>
                    </div>
                    <p className="text-xs text-sidebar-sender mt-0.5">
                      <ActivitySenderName senderId={m.sender_id} fallback={m.sender_full_name ?? ""} />
                    </p>
                    <p className="text-sm text-text-primary mt-1 line-clamp-2">
                      {stripHtml(m.content)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};
