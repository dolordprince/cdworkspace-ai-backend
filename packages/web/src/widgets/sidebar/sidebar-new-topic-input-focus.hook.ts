import { useEffect, type RefObject } from "react";

/** Focus the new-topic input after opening the inline editor. */
export function useSidebarNewTopicInputFocus(
  creatingTopicForSlug: string | null,
  newTopicInputRef: RefObject<HTMLInputElement | null>,
): void {
  useEffect(() => {
    if (creatingTopicForSlug == null) return;
    const timer = window.setTimeout(() => {
      const input = newTopicInputRef.current;
      if (!input) return;
      input.focus();
      const cursorPosition = input.value.length;
      input.setSelectionRange(cursorPosition, cursorPosition);
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [creatingTopicForSlug, newTopicInputRef]);
}
