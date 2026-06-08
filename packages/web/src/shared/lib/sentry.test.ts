import { afterEach, describe, expect, it, vi } from "vitest";

const sentryInit = vi.fn();
const setTag = vi.fn();
const addTransport = vi.fn();
const browserTracingIntegration = vi.fn(() => ({ name: "browserTracingIntegration" }));
const replayIntegration = vi.fn((options: Record<string, unknown>) => ({
  name: "replayIntegration",
  options,
}));

async function importProductionSentry() {
  vi.resetModules();
  vi.stubEnv("VITE_SENTRY_DSN", "https://public@example.invalid/1");
  vi.stubEnv("VITE_APP_VERSION", "1.2.3");

  vi.doMock("@sentry/react", () => ({
    init: sentryInit,
    setTag,
    addBreadcrumb: vi.fn(),
    setUser: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    browserTracingIntegration,
    replayIntegration,
  }));

  vi.doMock("./env", () => ({
    env: {
      DEV: false,
      PROD: true,
      MODE: "production",
    },
  }));

  vi.doMock("./logger", () => ({
    addTransport,
  }));

  vi.doMock("./pwa", () => ({
    getRuntime: () => "web",
  }));

  return import("./sentry");
}

describe("initSentry", () => {
  afterEach(() => {
    vi.doUnmock("@sentry/react");
    vi.doUnmock("./env");
    vi.doUnmock("./logger");
    vi.doUnmock("./pwa");
    vi.unstubAllEnvs();
    sentryInit.mockClear();
    setTag.mockClear();
    addTransport.mockClear();
    browserTracingIntegration.mockClear();
    replayIntegration.mockClear();
  });

  it("masks DOM text in production error replays", async () => {
    const { initSentry } = await importProductionSentry();

    initSentry();

    expect(replayIntegration).toHaveBeenCalledWith({
      maskAllText: true,
      blockAllMedia: true,
    });
    expect(sentryInit).toHaveBeenCalledWith(
      expect.objectContaining({
        replaysOnErrorSampleRate: 1,
        replaysSessionSampleRate: 0,
      }),
    );
  });
});
