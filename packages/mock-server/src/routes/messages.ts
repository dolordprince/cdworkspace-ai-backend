import type { Express, Request, Response } from "express";
import multer from "multer";
import { getStreamIdByName } from "./streams";

const formParser = multer();

interface MockReaction {
  emoji_name: string;
  emoji_code: string;
  reaction_type: string;
  user_id: number;
}

interface MockMessage {
  id: number;
  sender_id: number;
  sender_full_name: string;
  stream_id: number | null;
  channel?: string;
  subject: string;
  content: string;
  timestamp: number;
  reactions?: MockReaction[];
}

const now = Math.floor(Date.now() / 1000);

const SENDER_POOL = [
  { id: 1, name: "Илья Фомин" },
  { id: 2, name: "Дарья Исакова" },
  { id: 4, name: "Анна Дизайнер" },
  { id: 5, name: "Михаил Продакт" },
  { id: 6, name: "Екатерина QA" },
  { id: 7, name: "Сергей DevOps" },
  { id: 8, name: "Алексей Аналитик" },
  { id: 9, name: "Марина Поддержка" },
  { id: 10, name: "Олег Маркетинг" },
] as const;

const CONTENT_SAMPLES = [
  "Согласен, давайте так и сделаем.",
  "Можем обсудить на стендапе.",
  "Готово, проверьте в dev-окружении.",
  "Есть вопрос по макету — когда будет время?",
  "Напомню в четверг.",
  "Добавил в backlog.",
  "Это уже в работе.",
  "Кто-нибудь смотрел последний коммит?",
  "Предлагаю перенести на следующую неделю.",
  "Отличная идея 👍",
  "Нужна помощь с тестами.",
  "Обновил документацию.",
  "Митинг в 15:00 не забыли?",
  "Проверьте, пожалуйста, на мобилке.",
  "Скину ссылку в личку.",
  "Сделаю до конца дня.",
  "Есть блокер по API.",
  "Можно закрывать тикет.",
  "Кто ведёт ретро?",
  "Напишите в тред, если что.",
];

const TOPIC_SAMPLES = ["Welcome", "Design", "Roadmap", "Testing", "Общее", "Вопросы", "Идеи"];

function generateManyMessages(
  streamId: number,
  channel: string,
  startTs: number,
  endTs: number,
  count: number,
  startId: number
): MockMessage[] {
  const out: MockMessage[] = [];
  const step = Math.max(1, Math.floor((endTs - startTs) / count));
  for (let i = 0; i < count; i++) {
    const id = startId + i;
    const sender = SENDER_POOL[i % SENDER_POOL.length];
    const topic = TOPIC_SAMPLES[i % TOPIC_SAMPLES.length];
    out.push({
      id,
      sender_id: sender.id,
      sender_full_name: sender.name,
      stream_id: streamId,
      channel,
      subject: topic,
      content: CONTENT_SAMPLES[i % CONTENT_SAMPLES.length],
      timestamp: startTs + i * step,
    });
  }
  return out;
}

// Mutable store so POST can add messages
const messages: MockMessage[] = [
  // general
  {
    id: 1001,
    sender_id: 1,
    sender_full_name: "Илья Фомин",
    stream_id: 10,
    channel: "general",
    subject: "Welcome",
    content: "Добро пожаловать в кастомный клиент Zulip 👋",
    timestamp: now - 3600,
    reactions: [
      { emoji_name: "thumbs_up", emoji_code: "1f44d", reaction_type: "unicode_emoji", user_id: 999 },
      { emoji_name: "thumbs_up", emoji_code: "1f44d", reaction_type: "unicode_emoji", user_id: 1 },
      { emoji_name: "heart", emoji_code: "2764-fe0f", reaction_type: "unicode_emoji", user_id: 2 },
    ],
  },
  {
    id: 1002,
    sender_id: 2,
    sender_full_name: "Дарья Исакова",
    stream_id: 10,
    channel: "general",
    subject: "Design",
    content:
      "Залил новый макет в Figma: версия с информацией о канале справа. Нужно сверстать максимально близко.",
    timestamp: now - 3500,
    reactions: [
      { emoji_name: "heart", emoji_code: "2764-fe0f", reaction_type: "unicode_emoji", user_id: 4 },
    ],
  },
  {
    id: 1003,
    sender_id: 4,
    sender_full_name: "Анна Дизайнер",
    stream_id: 10,
    channel: "general",
    subject: "Design",
    content: "Обновила отступы и сетку. Проверьте, пожалуйста, в Dev mode.",
    timestamp: now - 3400,
  },
  {
    id: 1004,
    sender_id: 5,
    sender_full_name: "Михаил Продакт",
    stream_id: 10,
    channel: "general",
    subject: "Roadmap",
    content:
      "На этой неделе фокус на кастомном веб-клиенте для Zulip и интеграции с нашим OIDC.",
    timestamp: now - 3200,
  },
  {
    id: 1005,
    sender_id: 6,
    sender_full_name: "Екатерина QA",
    stream_id: 10,
    channel: "general",
    subject: "Testing",
    content:
      "Добавила чек-лист по проверке авторизации и навигации. Позже допишу сценарии для real-time обновлений.",
    timestamp: now - 3000,
  },
  {
    id: 1006,
    sender_id: 999,
    sender_full_name: "Вы",
    stream_id: 10,
    channel: "general",
    subject: "Welcome",
    content: "Спасибо, подключаю список сообщений и правую панель.",
    timestamp: now - 2900,
  },
  {
    id: 1007,
    sender_id: 999,
    sender_full_name: "Вы",
    stream_id: 10,
    channel: "general",
    subject: "Design",
    content: "Макет посмотрел, делаю шторку с информацией о канале.",
    timestamp: now - 2700,
  },
  // Ещё много сообщений в general для проверки прокрутки (примерно за 3 дня)
  ...generateManyMessages(10, "general", now - 86400 * 3, now - 3000, 120, 5000),
  // engineering
  {
    id: 1101,
    sender_id: 7,
    sender_full_name: "Сергей DevOps",
    stream_id: 11,
    channel: "engineering",
    subject: "Mock server",
    content:
      "Мок-сервер поднят на http://localhost:4000. Сейчас там /users, /streams, /messages с фикстурами.",
    timestamp: now - 2500,
  },
  {
    id: 1102,
    sender_id: 1,
    sender_full_name: "Илья Фомин",
    stream_id: 11,
    channel: "engineering",
    subject: "API client",
    content:
      "Фронт пока ходит в mock-server, позже подключим zulip-js и реальное API.",
    timestamp: now - 2300,
  },
  {
    id: 1103,
    sender_id: 2,
    sender_full_name: "Дарья Исакова",
    stream_id: 11,
    channel: "engineering",
    subject: "Layout",
    content:
      "Не забывайте, что верстка должна быть адаптивной, но при этом соответствовать десктопному макету 1920×1080.",
    timestamp: now - 2100,
  },
  {
    id: 1104,
    sender_id: 999,
    sender_full_name: "Вы",
    stream_id: 11,
    channel: "engineering",
    subject: "API client",
    content: "Пока ходим в mock, потом переключим на zulip-js.",
    timestamp: now - 2000,
  },
  // design
  {
    id: 1201,
    sender_id: 4,
    sender_full_name: "Анна Дизайнер",
    stream_id: 12,
    channel: "design",
    subject: "SVG assets",
    content:
      "Экспортировала основные иконки в SVG. Их нужно подключить в виде отдельных компонентов.",
    timestamp: now - 2000,
  },
  {
    id: 1202,
    sender_id: 4,
    sender_full_name: "Анна Дизайнер",
    stream_id: 12,
    channel: "design",
    subject: "Right panel",
    content:
      "В правой панели есть блоки: медиа, ссылки, комментарии со звонками и участники. Пока можно сделать статическими.",
    timestamp: now - 1800,
  },
  {
    id: 1203,
    sender_id: 999,
    sender_full_name: "Вы",
    stream_id: 12,
    channel: "design",
    subject: "SVG assets",
    content: "Иконки подключил как React-компоненты через Icon.",
    timestamp: now - 1700,
  },
  // product
  {
    id: 1301,
    sender_id: 5,
    sender_full_name: "Михаил Продакт",
    stream_id: 13,
    channel: "product",
    subject: "Navigation",
    content:
      "После первой страницы с чатом добавим верхний уровень навигации: список чатов, настройки и т.д.",
    timestamp: now - 1500,
  },
  // support
  {
    id: 1401,
    sender_id: 9,
    sender_full_name: "Марина Поддержка",
    stream_id: 14,
    channel: "support",
    subject: "Feedback",
    content:
      "Пользователи просят тёмную тему и компактный режим сообщений. Обсудим, как вписать это в наш UI.",
    timestamp: now - 1200,
  },
  {
    id: 1402,
    sender_id: 8,
    sender_full_name: "Алексей Аналитик",
    stream_id: 14,
    channel: "support",
    subject: "Metrics",
    content:
      "Собираю метрики по использованию чатов. В дальнейшем можно будет встроить графики прямо в правую панель.",
    timestamp: now - 900,
  },
  // random
  {
    id: 1501,
    sender_id: 10,
    sender_full_name: "Олег Маркетинг",
    stream_id: 15,
    channel: "random",
    subject: "Off-topic",
    content: "Кто идет на митап по React 19 в четверг?",
    timestamp: now - 800,
  },
  {
    id: 1502,
    sender_id: 6,
    sender_full_name: "Екатерина QA",
    stream_id: 15,
    channel: "random",
    subject: "Off-topic",
    content: "Я приду, можно обсудить опыт по тестированию real-time клиентов.",
    timestamp: now - 700,
  },
  {
    id: 1503,
    sender_id: 999,
    sender_full_name: "Вы",
    stream_id: 15,
    channel: "random",
    subject: "Off-topic",
    content: "Я тоже записался, до встречи в четверг.",
    timestamp: now - 600,
  },
];

// Личные диалоги: dm_id соответствует id из сайдбара (101, 102, 103, 104)
const dmMessages: Record<number, MockMessage[]> = {
  101: [
    {
      id: 2001,
      sender_id: 1,
      sender_full_name: "Илья Фомин",
      stream_id: null,
      subject: "",
      content: "Привет! Как продвигается верстка чата?",
      timestamp: now - 7200,
    },
    {
      id: 2002,
      sender_id: 999,
      sender_full_name: "Вы",
      stream_id: null,
      subject: "",
      content: "Уже делаю список сообщений и скролл к низу при переключении.",
      timestamp: now - 7000,
    },
    {
      id: 2003,
      sender_id: 1,
      sender_full_name: "Илья Фомин",
      stream_id: null,
      subject: "",
      content: "Отлично, тогда к концу недели посмотрим первый вариант.",
      timestamp: now - 6800,
      reactions: [
        { emoji_name: "thumbs_up", emoji_code: "1f44d", reaction_type: "unicode_emoji", user_id: 999 },
      ],
    },
  ],
  102: [
    {
      id: 2101,
      sender_id: 2,
      sender_full_name: "Дарья Исакова",
      stream_id: null,
      subject: "",
      content: "В группе договорились: митинг по дизайну в среду в 15:00.",
      timestamp: now - 5400,
    },
    {
      id: 2102,
      sender_id: 4,
      sender_full_name: "Анна Дизайнер",
      stream_id: null,
      subject: "",
      content: "Подтверждаю, буду с макетами.",
      timestamp: now - 5300,
    },
    {
      id: 2103,
      sender_id: 999,
      sender_full_name: "Вы",
      stream_id: null,
      subject: "",
      content: "Запишусь, спасибо.",
      timestamp: now - 5200,
    },
  ],
  103: [
    {
      id: 2201,
      sender_id: 2,
      sender_full_name: "Дарья Исакова",
      stream_id: null,
      subject: "",
      content: "Ок, тогда в четверг подойдёт?",
      timestamp: now - 86400,
    },
    {
      id: 2202,
      sender_id: 999,
      sender_full_name: "Вы",
      stream_id: null,
      subject: "",
      content: "Да, в четверг ок. Напишу за день.",
      timestamp: now - 86000,
    },
  ],
  104: [
    {
      id: 2301,
      sender_id: 5,
      sender_full_name: "Михаил Продакт",
      stream_id: null,
      subject: "",
      content: "Напоминаю: митинг в 15:00 по кастомному клиенту.",
      timestamp: now - 3600,
    },
    {
      id: 2302,
      sender_id: 999,
      sender_full_name: "Вы",
      stream_id: null,
      subject: "",
      content: "Буду, подготовлю демо по навигации.",
      timestamp: now - 3500,
    },
  ],
};

function nextId(): number {
  const ids = messages.map((m) => m.id);
  return ids.length ? Math.max(...ids) + 1 : 1;
}

function nextDmId(): number {
  const allDm = Object.values(dmMessages).flat();
  const ids = allDm.map((m) => m.id);
  return ids.length ? Math.max(...ids) + 1 : 3000;
}

export function getTopicsByStream(streamName: string): string[] {
  const seen = new Set<string>();
  messages
    .filter((m) => m.channel === streamName)
    .forEach((m) => seen.add(m.subject));
  return Array.from(seen).sort();
}

/** Формат сообщения Zulip API (GET /messages) */
function toZulipMessage(m: MockMessage): Record<string, unknown> {
  return {
    id: m.id,
    sender_id: m.sender_id,
    sender_full_name: m.sender_full_name,
    content: m.content,
    timestamp: m.timestamp,
    display_recipient: m.channel ?? "",
    subject: m.subject,
    type: m.stream_id !== null ? "stream" : "private",
    stream_id: m.stream_id ?? undefined,
    channel: m.channel,
    reactions: m.reactions ?? [],
  };
}

/** Парсинг narrow из Zulip API: [{"operator":"stream","operand":"general"},{"operator":"topic","operand":"Design"}] или dm */
function filterByNarrow(
  list: MockMessage[],
  narrow: unknown[]
): MockMessage[] {
  let out = list;
  for (const term of narrow) {
    if (!term || typeof term !== "object" || !("operator" in term) || !("operand" in term)) continue;
    const op = (term as { operator: string; operand: unknown }).operator;
    const operand = (term as { operator: string; operand: unknown }).operand;
    if (op === "stream" || op === "channel") {
      const name = typeof operand === "string" ? operand : String(operand);
      out = out.filter((m) => m.channel === name);
    } else if (op === "topic") {
      const name = typeof operand === "string" ? operand : String(operand);
      out = out.filter((m) => m.subject === name);
    } else if (op === "dm" || op === "pm-with") {
      const dmId = typeof operand === "number" ? operand : Array.isArray(operand) ? operand[0] : parseInt(String(operand), 10);
      if (!Number.isNaN(dmId) && dmId > 0) {
        out = dmMessages[dmId] ?? [];
      }
    } else if (op === "search") {
      const q = typeof operand === "string" ? operand : String(operand);
      if (q.trim()) {
        const lower = q.trim().toLowerCase();
        out = out.filter(
          (m) =>
            m.content.toLowerCase().includes(lower) ||
            (m.subject && m.subject.toLowerCase().includes(lower))
        );
      }
    }
  }
  return out;
}

export function registerMessagesRoutes(app: Express, apiBase: string) {
  // Устаревший эндпоинт для топиков по имени стрима (можно удалить, если везде перейдём на users/me/:id/topics)
  app.get(`${apiBase}/messages/topics`, (req: Request, res: Response) => {
    const { stream } = req.query;
    if (typeof stream !== "string") {
      res.status(400).json({ result: "error", msg: "stream required" });
      return;
    }
    res.json({
      result: "success",
      msg: "",
      topics: getTopicsByStream(stream),
    });
  });

  // GET /messages — Zulip API: narrow (JSON), anchor, num_before, num_after
  app.get(`${apiBase}/messages`, (req: Request, res: Response) => {
    const { narrow: narrowRaw, anchor, num_before, num_after } = req.query;
    const numBefore = Math.min(Math.max(0, parseInt(String(num_before), 10) || 50), 5000);
    const numAfter = Math.min(Math.max(0, parseInt(String(num_after), 10) || 0), 5000);

    let narrow: unknown[] = [];
    if (typeof narrowRaw === "string") {
      try {
        narrow = JSON.parse(narrowRaw) as unknown[];
        if (!Array.isArray(narrow)) narrow = [];
      } catch {
        narrow = [];
      }
    }

    const isDmNarrow = narrow.some(
      (t) => t && typeof t === "object" && "operator" in t && ((t as { operator: string }).operator === "dm" || (t as { operator: string }).operator === "pm-with")
    );
    const list = isDmNarrow
      ? (() => {
          const dmTerm = narrow.find(
            (t) => t && typeof t === "object" && "operator" in t && ("operand" in t) && ((t as { operator: string }).operator === "dm" || (t as { operator: string }).operator === "pm-with")
          ) as { operand: number | number[] } | undefined;
          const operand = dmTerm?.operand;
          const dmId = typeof operand === "number" ? operand : Array.isArray(operand) ? operand[0] : NaN;
          return dmMessages[Number.isNaN(dmId) ? 0 : dmId] ?? [];
        })()
      : filterByNarrow(messages, narrow);

    const sorted = [...list].sort((a, b) => a.id - b.id);
    const anchorVal = anchor === "newest" || anchor === "last" ? "newest" : String(anchor ?? "newest");
    let startIdx = sorted.length - 1;
    if (anchorVal === "newest" || anchorVal === "last") {
      startIdx = sorted.length - 1;
    } else if (anchorVal === "oldest" || anchorVal === "first") {
      startIdx = 0;
    } else {
      const anchorId = parseInt(anchorVal, 10);
      if (!Number.isNaN(anchorId)) {
        const found = sorted.findIndex((m) => m.id === anchorId);
        startIdx = found >= 0 ? found : sorted.length - 1;
      }
    }
    const beforeStart = Math.max(0, startIdx - numBefore);
    const afterEnd = Math.min(sorted.length, startIdx + numAfter + 1);
    const slice = sorted.slice(beforeStart, afterEnd);
    const zulipMessages = slice.map(toZulipMessage);

    res.json({
      result: "success",
      msg: "",
      messages: zulipMessages,
      found_newest: afterEnd >= sorted.length,
      found_oldest: beforeStart <= 0,
      anchor: slice[Math.min(numBefore, slice.length - 1)]?.id ?? sorted[sorted.length - 1]?.id,
    });
  });

  // POST /messages — Zulip API: type, to, topic, content (form, multipart or JSON)
  app.post(`${apiBase}/messages`, formParser.none(), (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const type = String(body.type ?? "stream").toLowerCase();
    const to = body.to;
    const topic = typeof body.topic === "string" ? body.topic : "general";
    const content = typeof body.content === "string" ? body.content : "";

    if (!content.trim()) {
      res.status(400).json({ result: "error", msg: "content required" });
      return;
    }

    if (type === "stream" || type === "channel") {
      const streamName = typeof to === "string" ? to : Array.isArray(to) ? String(to[0]) : String(to);
      const streamId = getStreamIdByName(streamName);
      const newMsg: MockMessage = {
        id: nextId(),
        sender_id: 999,
        sender_full_name: "Вы",
        stream_id: streamId,
        channel: streamName,
        subject: topic || "general",
        content: content.trim(),
        timestamp: Math.floor(Date.now() / 1000),
      };
      messages.push(newMsg);
      res.status(201).json({
        result: "success",
        msg: "",
        id: newMsg.id,
      });
      return;
    }

    if (type === "direct" || type === "private") {
      const toArr = Array.isArray(to)
        ? (to as unknown[]).map((x) => (typeof x === "number" ? x : parseInt(String(x), 10))).filter((n) => !Number.isNaN(n))
        : typeof to === "number"
          ? [to]
          : [parseInt(String(to), 10)].filter((n) => !Number.isNaN(n));
      if (toArr.length === 0) {
        res.status(400).json({ result: "error", msg: "private message requires to (user id or array)" });
        return;
      }
      const dmId = toArr[0];
      if (!dmMessages[dmId]) {
        dmMessages[dmId] = [];
      }
      const newMsg: MockMessage = {
        id: nextDmId(),
        sender_id: 999,
        sender_full_name: "Вы",
        stream_id: null,
        subject: "",
        content: content.trim(),
        timestamp: Math.floor(Date.now() / 1000),
      };
      dmMessages[dmId].push(newMsg);
      res.status(201).json({
        result: "success",
        msg: "",
        id: newMsg.id,
      });
      return;
    }

    res.status(400).json({ result: "error", msg: "type must be stream or direct" });
  });
}

