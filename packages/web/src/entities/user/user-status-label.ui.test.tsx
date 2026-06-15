import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserStatusLabel } from "./user-status-label.ui";

const ensureRealmEmojisLoadedMock = vi.hoisted(() => vi.fn());
const warnMock = vi.hoisted(() => vi.fn());

vi.mock("~/shared/lib/logger", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: warnMock,
    error: vi.fn(),
    child: vi.fn(),
  }),
}));

vi.mock("~/shared/lib/realm-emojis-cache", () => ({
  getCachedRealmEmojis: () => [],
  ensureRealmEmojisLoaded: (...args: unknown[]) => ensureRealmEmojisLoadedMock(...args),
}));

describe("UserStatusLabel", () => {
  beforeEach(() => {
    warnMock.mockReset();
    ensureRealmEmojisLoadedMock.mockReset();
    ensureRealmEmojisLoadedMock.mockResolvedValue([
      {
        id: "42",
        names: ["scam"],
        imgUrl: "https://chat.example.test/user_avatars/realm/42.png",
      },
    ]);
  });

  it("loads realm emoji image without exposing shortcode text", async () => {
    render(
      <UserStatusLabel
        status={{
          text: "Review",
          away: false,
          emojiName: "scam",
          emojiCode: "42",
          reactionType: "realm_emoji",
        }}
      />,
    );

    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.queryByText(":scam:")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTitle(":scam:")).toHaveAttribute(
        "src",
        "https://chat.example.test/user_avatars/realm/42.png",
      );
    });
    expect(screen.getByTitle(":scam:")).toHaveAttribute("alt", "");
  });

  it("gives emoji-only realm status image an accessible name", async () => {
    render(
      <UserStatusLabel
        status={{
          text: "",
          away: false,
          emojiName: "scam",
          emojiCode: "42",
          reactionType: "realm_emoji",
        }}
      />,
    );

    const emoji = await screen.findByRole("img", { name: ":scam:" });
    expect(emoji).toHaveAttribute("src", "https://chat.example.test/user_avatars/realm/42.png");
  });

  it("handles realm emoji load failures without leaving an unhandled rejection", async () => {
    ensureRealmEmojisLoadedMock.mockRejectedValue(new Error("network failed"));

    render(
      <UserStatusLabel
        status={{
          text: "",
          away: false,
          emojiName: "scam",
          emojiCode: "42",
          reactionType: "realm_emoji",
        }}
      />,
    );

    await waitFor(() => {
      expect(warnMock).toHaveBeenCalledWith("Failed to load realm emojis for user status", {
        error: "network failed",
      });
    });
    expect(screen.queryByText(":scam:")).not.toBeInTheDocument();
  });
});
