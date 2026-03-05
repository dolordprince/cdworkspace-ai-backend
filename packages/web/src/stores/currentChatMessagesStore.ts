import { create } from "zustand";
import type { MockMessage, Reaction, ZulipRawMessage } from "../lib/zulipClient";
import { dmConversationKey } from "../components/ui/Sidebar/data";

export type CurrentChatContext =
  | { type: "stream"; streamId: number; streamName: string; topic: string }
  | { type: "dm"; dmKey: string };

interface CurrentChatMessagesState {
  context: CurrentChatContext | null;
  messages: MockMessage[];
  setContext: (context: CurrentChatContext | null) => void;
  setMessages: (messages: MockMessage[]) => void;
  appendMessage: (msg: MockMessage) => void;
  removeMessage: (messageId: number) => void;
  removeMessages: (messageIds: number[]) => void;
  updateMessageReaction: (messageId: number, reaction: Reaction, op: "add" | "remove") => void;
  updateMessageFlags: (messageIds: number[], flag: string, op: "add" | "remove") => void;
  updateMessageContent: (messageId: number, content: string) => void;
}

export function isMessageForContext(
  msg: { type?: string; stream_id?: number | null; subject?: string; display_recipient?: string | Array<{ id: number }> },
  context: CurrentChatContext | null,
  currentUserId: number | null
): boolean {
  if (!context) return false;
  if (context.type === "stream") {
    return msg.type === "stream" && msg.stream_id === context.streamId && ((msg.subject ?? "").trim() || "general") === context.topic;
  }
  if (context.type === "dm") {
    if (msg.type !== "private" || !Array.isArray(msg.display_recipient)) return false;
    const key = dmConversationKey(msg.display_recipient, currentUserId);
    return key === context.dmKey;
  }
  return false;
}

export function contextFromMessage(
  msg: ZulipRawMessage,
  currentUserId: number | null
): CurrentChatContext | null {
  if (msg.type === "stream" && msg.stream_id != null) {
    const name = typeof msg.display_recipient === "string" ? msg.display_recipient : String(msg.stream_id);
    const topic = (msg.subject ?? "").trim() || "general";
    return { type: "stream", streamId: msg.stream_id, streamName: name, topic };
  }
  if (msg.type === "private" && Array.isArray(msg.display_recipient)) {
    const dmKey = dmConversationKey(msg.display_recipient, currentUserId);
    return { type: "dm", dmKey };
  }
  return null;
}

export const useCurrentChatMessagesStore = create<CurrentChatMessagesState>((set, get) => ({
  context: null,
  messages: [],

  setContext(context) {
    set({ context, messages: [] });
  },

  setMessages(messages) {
    set({ messages });
  },

  appendMessage(msg) {
    set((state) => {
      if (state.messages.some((m) => m.id === msg.id)) return state;
      return { messages: [...state.messages, msg] };
    });
  },

  removeMessage(messageId) {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    }));
  },

  removeMessages(messageIds) {
    const ids = new Set(messageIds);
    set((state) => ({
      messages: state.messages.filter((m) => !ids.has(m.id)),
    }));
  },

  updateMessageReaction(messageId, reaction, op) {
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== messageId) return m;
        const list = m.reactions ?? [];
        const exists = list.some(
          (r) => r.emoji_name === reaction.emoji_name && r.user_id === reaction.user_id
        );
        if (op === "add") {
          if (exists) return m;
          return { ...m, reactions: [...list, reaction] };
        }
        return { ...m, reactions: list.filter((r) => !(r.emoji_name === reaction.emoji_name && r.user_id === reaction.user_id)) };
      }),
    }));
  },

  updateMessageFlags(messageIds, flag, op) {
    const ids = new Set(messageIds);
    set((state) => ({
      messages: state.messages.map((m) => {
        if (!ids.has(m.id)) return m;
        const flags = m.flags ?? [];
        const hasFlag = flags.includes(flag);
        if (op === "add" && !hasFlag) return { ...m, flags: [...flags, flag] };
        if (op === "remove" && hasFlag) return { ...m, flags: flags.filter((f) => f !== flag) };
        return m;
      }),
    }));
  },

  updateMessageContent(messageId, content) {
    set((state) => ({
      messages: state.messages.map((m) => (m.id === messageId ? { ...m, content } : m)),
    }));
  },
}));
