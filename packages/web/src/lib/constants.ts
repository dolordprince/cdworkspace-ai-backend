/**
 * Общие классы скролла (tailwind-scrollbar).
 */
export const SCROLL_AREA_CLASS =
  "scrollbar scrollbar-thin scrollbar-thumb-border-subtle scrollbar-track-bg scrollbar-thumb-rounded-md";

/** Jitsi Meet: домен без протокола для JitsiMeeting (domain prop). Задаётся через VITE_JITSI_MEET_DOMAIN. */
export const JITSI_MEET_DOMAIN = import.meta.env.VITE_JITSI_MEET_DOMAIN ?? "";
/** Jitsi Meet: полный URL инстанса для ссылок в сообщениях. */
export const JITSI_MEET_BASE_URL = JITSI_MEET_DOMAIN
  ? `https://${JITSI_MEET_DOMAIN}`
  : "";

/** Workspace origin без слэша (и без /api/v1). Для аватарок и прочих URL без api/v1. */
export const WORKSPACE_ORIGIN = (import.meta.env.VITE_WORKSPACE_API_ORIGIN ?? "")
  .replace(/\/api\/v1\/?$/, "")
  .replace(/\/+$/, "");

/** Workspace origin + /api/v1. Для подстановки к относительным путям загрузок (картинок) в сообщениях. */
export const WORKSPACE_UPLOADS_ORIGIN = WORKSPACE_ORIGIN ? `${WORKSPACE_ORIGIN}/api/v1` : "";
