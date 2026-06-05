import { useCallback, useState } from "react";
import {
  getSidebarHiddenTopicCount,
  getSidebarVisibleTopicCount,
} from "./sidebar-topic-collapse.lib";

/**
 * Local state for expanding the full channel topic list.
 * The component unmounts when the channel collapses, so state resets automatically.
 */
export function useSidebarTopicCollapse(totalTopics: number): {
  allTopicsVisible: boolean;
  hiddenCount: number;
  showToggle: boolean;
  visibleCount: number;
  toggleAllTopics: () => void;
} {
  const [allTopicsVisible, setAllTopicsVisible] = useState(false);

  const hiddenCount = getSidebarHiddenTopicCount(totalTopics);
  const showToggle = hiddenCount > 0;
  const visibleCount = getSidebarVisibleTopicCount(totalTopics, allTopicsVisible);

  const toggleAllTopics = useCallback(() => {
    setAllTopicsVisible((prev) => !prev);
  }, []);

  return {
    allTopicsVisible,
    hiddenCount,
    showToggle,
    visibleCount,
    toggleAllTopics,
  };
}
