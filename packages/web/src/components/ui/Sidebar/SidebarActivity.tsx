import React from "react";
import { Icon } from "../Icon";
import { Badge } from "../Badge";
import { MY_ACTIVITY } from "./data";
import type { IconName } from "../Icon";

const ICON_COLORS: Record<string, string> = {
  favorites: "text-[#58A7F7]",
  pinned: "text-[#F04C4C]",
  mentions: "text-[#FFCC00]",
  reactions: "text-[#10BA4E]",
  drafts: "text-[#B86BEF]",
};

interface SidebarActivityProps {
  open: boolean;
  onToggle: () => void;
}

export const SidebarActivity: React.FC<SidebarActivityProps> = ({
  open,
  onToggle,
}) => {
  return (
    <div className="px-3 pt-4 pb-2">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left text-sm font-medium text-text-primary py-1"
      >
        Моя активность
        <span className="text-text-muted">
          {open ? (
            <Icon name="chevron-up" size={14} className="text-current" />
          ) : (
            <Icon name="chevron-down" size={14} className="text-current" />
          )}
        </span>
      </button>
      {open && (
        <ul className="mt-0.5 space-y-0.5">
          {MY_ACTIVITY.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className="w-full h-[46px] flex items-center rounded-[100px] p-[8px] gap-3 text-left text-sm text-text-primary hover:bg-sidebar-hover transition-colors"
              >
                <span
                  className="flex shrink-0 w-[30px] h-[30px] rounded-full items-center justify-center"
                  style={item.iconBg ? { backgroundColor: item.iconBg } : undefined}
                >
                  <Icon
                    name={item.icon as IconName}
                    size={24}
                    className={`shrink-0 ${ICON_COLORS[item.key] ?? ""}`}
                  />
                </span>
                <span className="flex-1 truncate">{item.label}</span>
                {"badge" in item && item.badge !== undefined && (
                  <Badge count={item.badge} variant="muted" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
