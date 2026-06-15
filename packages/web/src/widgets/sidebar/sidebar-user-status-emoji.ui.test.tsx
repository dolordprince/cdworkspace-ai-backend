import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarUserStatusEmoji } from "./sidebar-user-status-emoji.ui";

vi.mock("~/shared/lib/realm-emojis-cache", () => ({
  getCachedRealmEmojis: () => [
    {
      id: "42",
      names: ["party_parrot"],
      imgUrl: "https://chat.example.test/user_avatars/realm/42.png",
    },
  ],
  ensureRealmEmojisLoaded: () =>
    Promise.resolve([
      {
        id: "42",
        names: ["party_parrot"],
        imgUrl: "https://chat.example.test/user_avatars/realm/42.png",
      },
    ]),
}));

describe("SidebarUserStatusEmoji", () => {
  it("renders nothing when status has no emoji", () => {
    render(<SidebarUserStatusEmoji status={{ text: "Busy", away: false }} />);
    expect(screen.queryByTestId("sidebar-user-status-emoji")).not.toBeInTheDocument();
  });

  it("renders unicode emoji from emoji_code", () => {
    render(
      <SidebarUserStatusEmoji
        status={{
          text: "Hi",
          away: false,
          emojiCode: "1f697",
          emojiName: "car",
          reactionType: "unicode_emoji",
        }}
      />,
    );
    expect(screen.getByTestId("sidebar-user-status-emoji")).toHaveTextContent("🚗");
  });

  it("renders realm emoji image from cached metadata", () => {
    render(
      <SidebarUserStatusEmoji
        status={{
          text: "Party",
          away: false,
          emojiCode: "42",
          emojiName: "party_parrot",
          reactionType: "realm_emoji",
        }}
      />,
    );

    const emoji = screen.getByTestId("sidebar-user-status-emoji");
    expect(emoji.tagName).toBe("IMG");
    expect(emoji).toHaveAccessibleName(":party_parrot:");
    expect(emoji).toHaveAttribute("src", "https://chat.example.test/user_avatars/realm/42.png");
  });
});
