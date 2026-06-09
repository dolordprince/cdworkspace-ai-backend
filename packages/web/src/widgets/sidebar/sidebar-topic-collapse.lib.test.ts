import { describe, expect, it } from "vitest";
import {
  getSidebarHiddenTopicCount,
  getSidebarVisibleTopicCount,
  shouldTruncateSidebarTopics,
  SIDEBAR_COLLAPSED_TOPIC_LIMIT,
} from "./sidebar-topic-collapse.lib";

describe("sidebar-topic-collapse.lib", () => {
  it("limits collapsed topic list to three items", () => {
    expect(SIDEBAR_COLLAPSED_TOPIC_LIMIT).toBe(3);
  });

  describe("getSidebarHiddenTopicCount", () => {
    it("returns zero when topics fit the collapsed limit", () => {
      expect(getSidebarHiddenTopicCount(0)).toBe(0);
      expect(getSidebarHiddenTopicCount(3)).toBe(0);
    });

    it("returns overflow count above the collapsed limit", () => {
      expect(getSidebarHiddenTopicCount(5)).toBe(2);
    });
  });

  describe("shouldTruncateSidebarTopics", () => {
    it("truncates only when list is collapsed and has hidden topics", () => {
      expect(shouldTruncateSidebarTopics(5, false)).toBe(true);
      expect(shouldTruncateSidebarTopics(5, true)).toBe(false);
      expect(shouldTruncateSidebarTopics(2, false)).toBe(false);
    });
  });

  describe("getSidebarVisibleTopicCount", () => {
    it("shows three topics while collapsed", () => {
      expect(getSidebarVisibleTopicCount(10, false)).toBe(3);
    });

    it("shows all topics after expand", () => {
      expect(getSidebarVisibleTopicCount(10, true)).toBe(10);
    });
  });
});
