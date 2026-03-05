/**
 * Формат времени сообщения (HH:MM, ru-RU).
 */
export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Порог в секундах: если presence timestamp новее этого — считаем «онлайн». */
const PRESENCE_ONLINE_THRESHOLD_SEC = 2 * 60;

/**
 * Форматирует «последний раз в сети» по presence timestamp и статусу.
 * Если status === "active" и timestamp не старше 2 минут — «онлайн», иначе «был(а) N мин/часов назад».
 */
export function formatLastSeen(
  timestamp: number,
  status?: "active" | "idle"
): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (status === "active" && diff <= PRESENCE_ONLINE_THRESHOLD_SEC) {
    return "онлайн";
  }
  if (diff < 60) return "только что";
  if (diff < 3600) {
    const min = Math.floor(diff / 60);
    return `${min} мин назад`;
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `${h} ${h === 1 ? "ч" : "ч"} назад`;
  }
  const d = Math.floor(diff / 86400);
  return `${d} ${d === 1 ? "день" : d < 5 ? "дня" : "дней"} назад`;
}

/**
 * Возвращает true, если по presence пользователь считается онлайн (active и не старше порога).
 */
export function isPresenceOnline(
  timestamp: number,
  status?: "active" | "idle"
): boolean {
  const now = Math.floor(Date.now() / 1000);
  return status === "active" && now - timestamp <= PRESENCE_ONLINE_THRESHOLD_SEC;
}

/**
 * Возвращает состояние presence для индикатора: active (зелёный), idle (оранжевый) или null (офлайн).
 */
export function getPresenceState(
  timestamp: number,
  status?: "active" | "idle"
): "active" | "idle" | null {
  const now = Math.floor(Date.now() / 1000);
  if (now - timestamp > PRESENCE_ONLINE_THRESHOLD_SEC) return null;
  if (status === "active") return "active";
  if (status === "idle") return "idle";
  return null;
}

/**
 * Классы строки сайдбара: активная или с hover.
 */
export function sidebarRowClass(isActive: boolean): string {
  return isActive ? "bg-sidebar-hover" : "hover:bg-sidebar-hover";
}
