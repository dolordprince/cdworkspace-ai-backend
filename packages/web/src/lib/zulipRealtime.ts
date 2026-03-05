/**
 * Цикл long-poll для Zulip Real-Time Events API.
 * Регистрирует очередь, запрашивает события в цикле, при BAD_EVENT_QUEUE_ID — перерегистрация.
 */
import { registerQueue, getEvents, type ZulipEvent } from "./zulipClient";

const DEFAULT_EVENT_TYPES = [
  "message",
  "update_message_flags",
  "reaction",
  "delete_message",
] as const;

const RETRY_PAUSE_MS = 2000;
const DEFAULT_LONGPOLL_TIMEOUT_SEC = 90;

export interface StartZulipEventLoopOptions {
  /** Вызывается для каждого полученного события (кроме heartbeat). */
  onEvent: (event: ZulipEvent) => void;
  /** Вызывается при ошибке BAD_EVENT_QUEUE_ID перед перерегистрацией. */
  onBadQueue?: () => void;
  /** Отмена цикла при смене инстанса/разлогине. */
  signal?: AbortSignal;
  /** Типы событий для register. По умолчанию message, update_message_flags, reaction, delete_message. */
  eventTypes?: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Запускает фоновый цикл: register → getEvents (long-poll) в цикле.
 * При BAD_EVENT_QUEUE_ID перерегистрирует очередь и продолжает.
 * При signal.abort цикл завершается.
 */
export function startZulipEventLoop(options: StartZulipEventLoopOptions): void {
  const { onEvent, onBadQueue, signal, eventTypes = [...DEFAULT_EVENT_TYPES] } = options;
  let queueId: string | null = null;
  let lastEventId = -1;
  let longpollTimeoutSec = DEFAULT_LONGPOLL_TIMEOUT_SEC;

  function handleEvent(event: ZulipEvent): void {
    lastEventId = Math.max(lastEventId, event.id);
    if (event.type === "heartbeat") return;
    onEvent(event);
  }

  async function runLoop(): Promise<void> {
    while (true) {
      if (signal?.aborted) return;

      if (!queueId) {
        try {
          const reg = await registerQueue(eventTypes);
          queueId = reg.queue_id;
          lastEventId = reg.last_event_id;
          longpollTimeoutSec =
            reg.event_queue_longpoll_timeout_seconds ?? DEFAULT_LONGPOLL_TIMEOUT_SEC;
        } catch (err) {
          if (signal?.aborted) return;
          await sleep(RETRY_PAUSE_MS);
          continue;
        }
      }

      try {
        const result = await getEvents(queueId, lastEventId, {
          timeoutSec: longpollTimeoutSec,
          signal,
        });
        if (signal?.aborted) return;

        if (result.result === "error" && result.code === "BAD_EVENT_QUEUE_ID") {
          queueId = null;
          onBadQueue?.();
          continue;
        }

        if (result.events) {
          for (const ev of result.events) {
            handleEvent(ev);
          }
        }
      } catch (err) {
        if (signal?.aborted) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("abort") || msg === "The operation was aborted") return;
        queueId = null;
        await sleep(RETRY_PAUSE_MS);
      }
    }
  }

  runLoop().catch(() => {
    // Цикл завершён (abort или фатальная ошибка)
  });
}
