import type { Express, Request, Response } from "express";

interface MockStream {
  stream_id: number;
  name: string;
  description: string;
  is_announcement_only: boolean;
}

const streams: MockStream[] = [
  {
    stream_id: 10,
    name: "general",
    description: "Общий канал команды",
    is_announcement_only: false,
  },
  {
    stream_id: 11,
    name: "engineering",
    description: "Разработка и архитектура",
    is_announcement_only: false,
  },
  {
    stream_id: 12,
    name: "design",
    description: "Дизайн, макеты Figma, UI-kit",
    is_announcement_only: false,
  },
  {
    stream_id: 13,
    name: "product",
    description: "Продуктовые обсуждения, roadmap",
    is_announcement_only: false,
  },
  {
    stream_id: 14,
    name: "support",
    description: "Обсуждение обращений пользователей",
    is_announcement_only: false,
  },
  {
    stream_id: 15,
    name: "random",
    description: "Оффтоп, мемы, котики",
    is_announcement_only: false,
  },
];

export function getStreamIdByName(name: string): number | null {
  const s = streams.find((x) => x.name === name);
  return s ? s.stream_id : null;
}

export function getStreamNameById(streamId: number): string | null {
  const s = streams.find((x) => x.stream_id === streamId);
  return s ? s.name : null;
}

/** Топики по stream_id (для GET /users/me/:streamId/topics в формате Zulip) */
export function getTopicsByStreamId(
  streamId: number,
  getTopicsForStreamName: (name: string) => string[]
): string[] {
  const name = getStreamNameById(streamId);
  return name ? getTopicsForStreamName(name) : [];
}

export function registerStreamsRoutes(
  app: Express,
  apiBase: string,
  getTopicsForStreamName: (name: string) => string[]
): void {
  // GET /streams — Zulip API
  app.get(`${apiBase}/streams`, (_req: Request, res: Response) => {
    res.json({
      result: "success",
      msg: "",
      streams,
    });
  });

  // GET /users/me/:streamId/topics — Zulip API (zulip-js streams.topics.retrieve)
  app.get(`${apiBase}/users/me/:streamId/topics`, (req: Request, res: Response) => {
    const streamId = parseInt(req.params.streamId, 10);
    if (Number.isNaN(streamId)) {
      res.status(400).json({ result: "error", msg: "Invalid stream_id" });
      return;
    }
    const topics = getTopicsByStreamId(streamId, getTopicsForStreamName);
    res.json({
      result: "success",
      msg: "",
      topics: topics.map((name) => ({ name })),
    });
  });
}

