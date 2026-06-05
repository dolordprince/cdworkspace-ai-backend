/** How many topics to show in the sidebar before the "Show more" button. */
export const SIDEBAR_COLLAPSED_TOPIC_LIMIT = 3;

/** How many topics are hidden while the list is collapsed. */
export function getSidebarHiddenTopicCount(totalTopics: number): number {
  return Math.max(0, totalTopics - SIDEBAR_COLLAPSED_TOPIC_LIMIT);
}

/** Whether to truncate the topic list (hidden topics exist and the user has not expanded fully). */
export function shouldTruncateSidebarTopics(
  totalTopics: number,
  allTopicsVisible: boolean,
): boolean {
  return !allTopicsVisible && getSidebarHiddenTopicCount(totalTopics) > 0;
}

/** How many topics to render given collapsed/expanded state. */
export function getSidebarVisibleTopicCount(
  totalTopics: number,
  allTopicsVisible: boolean,
): number {
  return shouldTruncateSidebarTopics(totalTopics, allTopicsVisible)
    ? SIDEBAR_COLLAPSED_TOPIC_LIMIT
    : totalTopics;
}
