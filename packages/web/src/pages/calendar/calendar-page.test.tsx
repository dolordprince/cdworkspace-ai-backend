import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "~/test/render";

describe("CalendarPage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("renders unavailable fallback by default when embed URL is not allowed", async () => {
    vi.resetModules();
    const { CalendarPage } = await import("./calendar-page.ui");

    renderWithProviders(<CalendarPage />);

    expect(screen.queryByTitle(/calendar/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /calendar/i })).toBeInTheDocument();
    expect(screen.getByText(/temporarily unavailable in web mode/i)).toBeInTheDocument();
  });

  it("uses configurable calendar embed URL", async () => {
    vi.stubEnv("VITE_CALENDAR_EMBED_URL", "https://calendar.example.com/mock.html");
    vi.stubEnv("VITE_EMBED_ALLOWED_ORIGINS", "https://calendar.example.com");
    vi.resetModules();
    const { CalendarPage } = await import("./calendar-page.ui");

    renderWithProviders(<CalendarPage />);

    expect(screen.getByTitle(/calendar/i)).toHaveAttribute(
      "src",
      "https://calendar.example.com/mock.html",
    );
  });
});
