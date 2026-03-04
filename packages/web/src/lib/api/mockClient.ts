const DEFAULT_API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export interface MockUser {
  user_id: number;
  email: string;
  full_name: string;
  is_bot: boolean;
  is_active: boolean;
}

export interface MockStream {
  stream_id: number;
  name: string;
  description: string;
  is_announcement_only: boolean;
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

export async function fetchUsers(): Promise<MockUser[]> {
  const res = await fetch(`${DEFAULT_API_BASE}/api/v1/users`);
  const data = await res.json();
  return data.members ?? [];
}

export async function fetchStreams(): Promise<MockStream[]> {
  const res = await fetch(`${DEFAULT_API_BASE}/api/v1/streams`);
  const data = await res.json();
  return data.streams ?? [];
}

export async function fetchMessages(
  stream?: string,
  topic?: string,
  q?: string
): Promise<MockMessage[]> {
  const url = new URL(`${DEFAULT_API_BASE}/api/v1/messages`);
  if (stream) url.searchParams.set("stream", stream);
  if (topic) url.searchParams.set("topic", topic);
  if (q?.trim()) url.searchParams.set("q", q.trim());
  const res = await fetch(url.toString());
  const data = await res.json();
  return data.messages ?? [];
}

export async function fetchDmMessages(dmId: number): Promise<MockMessage[]> {
  const url = new URL(`${DEFAULT_API_BASE}/api/v1/messages`);
  url.searchParams.set("dm", String(dmId));
  const res = await fetch(url.toString());
  const data = await res.json();
  return data.messages ?? [];
}

export async function fetchTopics(stream: string): Promise<string[]> {
  const url = new URL(`${DEFAULT_API_BASE}/api/v1/messages/topics`);
  url.searchParams.set("stream", stream);
  const res = await fetch(url.toString());
  const data = await res.json();
  return data.topics ?? [];
}

export interface SendMessageParams {
  stream: string;
  subject?: string;
  content: string;
  sender_id?: number;
  sender_full_name?: string;
}

export async function sendMessage(
  params: SendMessageParams
): Promise<MockMessage> {
  const res = await fetch(`${DEFAULT_API_BASE}/api/v1/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stream: params.stream,
      subject: params.subject ?? "general",
      content: params.content,
      sender_id: params.sender_id,
      sender_full_name: params.sender_full_name,
    }),
  });
  const data = await res.json();
  if (data.result !== "success" || !data.message) {
    throw new Error(data.msg ?? "Failed to send message");
  }
  return data.message;
}

