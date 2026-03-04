/**
 * Клиент Zulip API через zulip-js.
 * Мок-сервер должен отдавать API в формате Zulip; базовый URL задаётся через VITE_API_BASE_URL.
 */
import { Buffer } from "buffer";

if (typeof (globalThis as unknown as { Buffer?: unknown }).Buffer === "undefined") {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

import zulipInitDefault from "zulip-js";
const zulipInit = (zulipInitDefault as unknown as (config: {
  realm: string;
  username: string;
  apiKey: string;
}) => Promise<{
  streams: {
    retrieve: (params?: Record<string, unknown>) => Promise<{ streams?: { stream_id: number; name: string; description?: string }[] }>;
    topics: { retrieve: (params: { stream_id: number }) => Promise<{ topics?: { name: string }[] }> };
  };
  messages: {
    retrieve: (params: {
      narrow?: { operator: string; operand: string | number | number[] }[];
      anchor?: string | number;
      num_before?: number;
      num_after?: number;
    }) => Promise<{
      messages?: Array<{
        id: number;
        sender_id: number;
        sender_full_name?: string;
        content: string;
        timestamp: number;
        display_recipient?: string;
        subject?: string;
        type?: string;
        stream_id?: number | null;
      }>;
    }>;
    send: (params: { type: string; to: string | number[]; topic?: string; content: string }) => Promise<{ id?: number }>;
  };
}>);

const baseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:4000";
const realm = baseUrl.replace(/\/api\/v1$/, "");
const apiBaseUrl = `${realm}/api/v1`;

let clientPromise: ReturnType<typeof zulipInit> | null = null;

function getClient() {
  if (!clientPromise) {
    clientPromise = zulipInit({
      realm,
      username: "dev@mock.zulip",
      apiKey: "mock-api-key",
    });
  }
  return clientPromise;
}

export interface MockStream {
  stream_id: number;
  name: string;
  description: string;
  is_announcement_only: boolean;
}

export interface MockFolder {
  id: string;
  label: string;
  badge?: number;
}

export async function fetchFolders(): Promise<MockFolder[]> {
  const res = await fetch(`${apiBaseUrl}/folders`);
  if (!res.ok) return [];
  const data = (await res.json()) as { folders?: MockFolder[] };
  return data.folders ?? [];
}

export interface MockMessage {
  id: number;
  sender_id: number;
  sender_full_name: string;
  stream_id: number | null;
  channel?: string;
  subject: string;
  content: string;
  timestamp: number;
}

function mapZulipMessage(m: {
  id: number;
  sender_id: number;
  sender_full_name?: string;
  content: string;
  timestamp: number;
  display_recipient?: string;
  subject?: string;
  type?: string;
  stream_id?: number | null;
}): MockMessage {
  return {
    id: m.id,
    sender_id: m.sender_id,
    sender_full_name: m.sender_full_name ?? "",
    stream_id: m.stream_id ?? (m.type === "private" ? null : m.stream_id ?? null),
    channel: typeof m.display_recipient === "string" ? m.display_recipient : undefined,
    subject: m.subject ?? "",
    content: m.content,
    timestamp: m.timestamp,
  };
}

export async function fetchStreams(): Promise<MockStream[]> {
  const client = await getClient();
  const data = await client.streams.retrieve();
  const list = data.streams ?? [];
  return list.map((s) => ({
    stream_id: s.stream_id,
    name: s.name,
    description: s.description ?? "",
    is_announcement_only: false,
  }));
}

export async function fetchMessages(
  stream?: string,
  topic?: string,
  q?: string
): Promise<MockMessage[]> {
  const client = await getClient();
  const narrow: { operator: string; operand: string }[] = [];
  if (stream) narrow.push({ operator: "stream", operand: stream });
  if (topic) narrow.push({ operator: "topic", operand: topic });
  if (q?.trim()) narrow.push({ operator: "search", operand: q.trim() });
  const data = await client.messages.retrieve({
    narrow: narrow.length ? narrow : undefined,
    anchor: "newest",
    num_before: 1000,
    num_after: 0,
  });
  const list = data.messages ?? [];
  return list.map(mapZulipMessage);
}

export async function fetchDmMessages(dmId: number): Promise<MockMessage[]> {
  const client = await getClient();
  const data = await client.messages.retrieve({
    narrow: [{ operator: "dm", operand: dmId }],
    anchor: "newest",
    num_before: 1000,
    num_after: 0,
  });
  const list = data.messages ?? [];
  return list.map(mapZulipMessage);
}

export async function fetchTopics(stream: string): Promise<string[]> {
  const client = await getClient();
  const streamsData = await client.streams.retrieve();
  const streamObj = (streamsData.streams ?? []).find((s) => s.name === stream);
  if (!streamObj) return [];
  const data = await client.streams.topics.retrieve({ stream_id: streamObj.stream_id });
  return (data.topics ?? []).map((t) => t.name);
}

export interface SendMessageParams {
  stream: string;
  subject?: string;
  content: string;
  sender_id?: number;
  sender_full_name?: string;
}

export async function sendMessage(params: SendMessageParams): Promise<MockMessage> {
  const client = await getClient();
  const result = await client.messages.send({
    type: "stream",
    to: params.stream,
    topic: params.subject ?? "general",
    content: params.content,
  });
  const id = result.id ?? 0;
  return {
    id,
    sender_id: 999,
    sender_full_name: params.sender_full_name ?? "Вы",
    stream_id: null,
    channel: params.stream,
    subject: params.subject ?? "general",
    content: params.content,
    timestamp: Math.floor(Date.now() / 1000),
  };
}
