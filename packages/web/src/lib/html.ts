import DOMPurify from "dompurify";

/**
 * Убирает HTML-теги из строки (для копирования текста сообщения в буфер обмена).
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/** Разрешённые теги для контента сообщений (Zulip-формат). */
const MESSAGE_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "span",
  "div",
  "img",
];

/** Атрибуты, разрешённые дополнительно (например, src у img). */
const MESSAGE_ADD_ATTR = ["src", "alt"];

/**
 * Преобразует относительные URL в тегах img в абсолютные (префикс baseUrl).
 * baseUrl — хост Zulip без завершающего слэша.
 */
function rewriteRelativeImgSrc(html: string, baseUrl: string): string {
  if (!baseUrl?.trim()) return html;
  const base = baseUrl.replace(/\/+$/, "");
  return html.replace(
    /<img\s[^>]*?src=(["'])([^"']+)\1/gi,
    (_match, quote: string, src: string) => {
      const s = src.trim();
      if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:")) {
        return _match;
      }
      const absolute = s.startsWith("/") ? `${base}${s}` : `${base}/${s}`;
      return _match.replace(src, absolute);
    }
  );
}

/**
 * Санитизирует HTML контента сообщения для безопасного рендера (защита от XSS).
 * Если передан baseUrl (хост Zulip), относительные src у картинок превращаются в абсолютные.
 */
export function sanitizeHtml(html: string, baseUrl?: string): string {
  const toSanitize = baseUrl ? rewriteRelativeImgSrc(html, baseUrl) : html;
  return DOMPurify.sanitize(toSanitize, {
    ALLOWED_TAGS: MESSAGE_ALLOWED_TAGS,
    ADD_ATTR: MESSAGE_ADD_ATTR,
  });
}
