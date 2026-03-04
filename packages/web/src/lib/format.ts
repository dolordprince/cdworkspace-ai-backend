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

/**
 * Классы строки сайдбара: активная или с hover.
 */
export function sidebarRowClass(isActive: boolean): string {
  return isActive ? "bg-sidebar-hover" : "hover:bg-sidebar-hover";
}
