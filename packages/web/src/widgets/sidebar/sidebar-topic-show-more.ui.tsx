import React, { useMemo } from "react";
import { t } from "~/i18n/i18n";
import { Icon } from "~/shared/ui/icon";

export interface SidebarTopicShowMoreButtonProps {
  /** Full topic list is expanded. */
  expanded: boolean;
  /** How many topics are currently hidden (for the parenthetical label). */
  hiddenCount: number;
  onToggle: () => void;
}

export const SidebarTopicShowMoreButton = React.memo<SidebarTopicShowMoreButtonProps>(
  function SidebarTopicShowMoreButton({ expanded, hiddenCount, onToggle }) {
    const label = useMemo(() => {
      if (expanded) {
        return t("channel.hideExtraTopics");
      }
      if (hiddenCount > 0) {
        return t("channel.showMoreTopicsWithCount", { count: hiddenCount });
      }
      return t("channel.showMoreTopics");
    }, [expanded, hiddenCount]);

    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        className="flex w-full items-center rounded-b-lg bg-sidebar-hover py-2 pr-2 text-sm font-medium text-text-primary transition-colors hover:opacity-90"
        aria-expanded={expanded}
        aria-label={label}
      >
        {/* Same indent chain as topic rows: ml-4 + pl-2 container, border-l-4, link pl-3 */}
        <span className="ml-4 flex min-w-0 flex-1 items-center border-l-4 border-transparent pl-2">
          <span className="truncate pl-3">{label}</span>
        </span>
        {expanded ? (
          <Icon name="chevron-up" size={16} className="ml-2 shrink-0 text-text-primary" />
        ) : (
          <Icon name="chevron-down" size={16} className="ml-2 shrink-0 text-text-primary" />
        )}
      </button>
    );
  },
);
