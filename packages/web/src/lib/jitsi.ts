import { JITSI_MEET_BASE_URL, JITSI_MEET_DOMAIN } from "./constants";

/** Извлечь первую ссылку на Jitsi из текста (наш инстанс или meet.jit.si). */
export function getJitsiMeetingUrl(content: string): string | null {
  const trimmed = content.trim();
  if (trimmed.startsWith(JITSI_MEET_BASE_URL + "/")) return trimmed;
  if (trimmed === JITSI_MEET_BASE_URL) return null;
  // Ищем URL нашего домена или meet.jit.si в тексте
  const pattern = new RegExp(
    `https?://(?:${escapeRegex(JITSI_MEET_DOMAIN)}|meet\\.jit\\.si)/([^\\s<>"']+)`,
    "i"
  );
  const match = trimmed.match(pattern);
  return match ? match[0] : null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface JitsiUrlParts {
  domain: string;
  roomName: string;
}

/** Разбор URL для JitsiMeeting: домен и roomName из path. */
export function parseJitsiUrl(url: string): JitsiUrlParts | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.replace(/^\/+/, "").split("/")[0];
    if (!path) return null;
    // Поддерживаем наш инстанс и meet.jit.si
    if (host === JITSI_MEET_DOMAIN || host === "meet.jit.si") {
      return {
        domain: host,
        roomName: decodeURIComponent(path),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Собрать URL комнаты по имени (для отправки в чат). */
export function buildJitsiMeetingUrl(roomName: string): string {
  const encoded = encodeURIComponent(roomName);
  return `${JITSI_MEET_BASE_URL}/${encoded}`;
}
