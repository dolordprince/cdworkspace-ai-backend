import { describe, expect, it } from "vitest";
import {
  encodeEmojiToCode,
  formatUserStatusLabel,
  getUserStatusEmoji,
  getUserStatusEmojiDisplay,
  normalizeStatusEmojiName,
} from "./user-status.lib";

describe("user-status.lib", () => {
  it("formats emoji and text when unicode emoji code exists", () => {
    const label = formatUserStatusLabel({
      text: "Working remotely",
      emojiCode: "1f3e0",
      away: false,
    });

    expect(label).toBe("🏠 Working remotely");
  });

  it("decodes combined unicode codepoints", () => {
    const emoji = getUserStatusEmoji({
      text: "",
      emojiCode: "1f1fa-1f1e6",
      away: false,
    });

    expect(emoji).toBe("🇺🇦");
  });

  it("does not expose realm emoji shortcode when image metadata is unavailable", () => {
    const emoji = getUserStatusEmoji({
      text: "",
      emojiName: "party_parrot",
      emojiCode: "42",
      reactionType: "realm_emoji",
      away: false,
    });

    expect(emoji).toBeNull();
  });

  it("does not expose realm emoji-only status as shortcode text", () => {
    const label = formatUserStatusLabel({
      text: "",
      emojiName: "party_parrot",
      emojiCode: "42",
      reactionType: "realm_emoji",
      away: false,
    });

    expect(label).toBeNull();
  });

  it("keeps status text when realm emoji image metadata is unavailable", () => {
    const label = formatUserStatusLabel({
      text: "Review",
      emojiName: "scam",
      emojiCode: "42",
      reactionType: "realm_emoji",
      away: false,
    });

    expect(label).toBe("Review");
  });

  it("resolves realm emoji image from cached metadata", () => {
    const display = getUserStatusEmojiDisplay(
      {
        text: "",
        emojiName: "party_parrot",
        emojiCode: "42",
        reactionType: "realm_emoji",
        away: false,
      },
      [
        {
          id: "42",
          names: ["party_parrot"],
          imgUrl: "https://chat.example.test/user_avatars/realm/42.png",
        },
      ],
    );

    expect(display).toEqual({
      kind: "image",
      src: "https://chat.example.test/user_avatars/realm/42.png",
      alt: ":party_parrot:",
    });
  });

  it("uses emoji-name fallback when emoji code is absent", () => {
    const label = formatUserStatusLabel({
      text: "Lunch",
      emojiName: "plate_with_cutlery",
      away: false,
    });

    expect(label).toBe("🍽️ Lunch");
  });

  it("returns null for empty status payload", () => {
    const label = formatUserStatusLabel({
      text: "   ",
      away: false,
    });

    expect(label).toBeNull();
  });

  it("encodes emoji to unicode codepoints", () => {
    expect(encodeEmojiToCode("🧪")).toBe("1f9ea");
    expect(encodeEmojiToCode("🍽️")).toBe("1f37d-fe0f");
  });

  it("normalizes status emoji names from picker data", () => {
    expect(normalizeStatusEmojiName(" Test Tube ")).toBe("test_tube");
    expect(normalizeStatusEmojiName(":thumbs-up:")).toBe("thumbs_up");
  });
});
