import React from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

export type TopBarSection = "chat" | "calendar" | "mail" | "calls";

interface TopBarProps {
  activeSection: TopBarSection;
  onSectionChange: (section: TopBarSection) => void;
  onOpenSearch?: () => void;
  /** Открыть шторку профиля текущего пользователя */
  onOpenProfile?: () => void;
}

const SECTIONS: { id: TopBarSection; icon: "chatBubble" | "calendar" | "mail" | "phone"; label: string }[] = [
  { id: "chat", icon: "chatBubble", label: "Чаты" },
  { id: "calendar", icon: "calendar", label: "Календарь" },
  { id: "mail", icon: "mail", label: "Почта" },
  { id: "calls", icon: "phone", label: "Звонки" },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onSectionChange,
  onOpenSearch,
  onOpenProfile,
}) => {
  return (
    <header className="w-full bg-bg-elevated flex items-center justify-between p-[8px] border-b border-border-subtle gap-4 rounded-b-[12px] mb-1">
      {/* Центр: секции приложения */}
      <div className="flex-1 flex flex-col items-center justify-center gap-1.5 min-w-0">
        <div className="flex items-center gap-2">
          {SECTIONS.map(({ id, icon, label }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSectionChange(id)}
                className={`w-16 h-16 flex items-center justify-center rounded-[12px] opacity-100 transition-colors ${
                  isActive
                    ? "bg-[var(--color-Icon-disable,#FFFFFF1A)] text-text-primary"
                    : "text-text-muted hover:bg-bg/50 hover:text-text-primary"
                }`}
                aria-label={label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon name={icon} size={40} className="text-current" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Справа: профиль текущего пользователя — по клику открывается шторка */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={onOpenProfile}
          className="relative flex items-center gap-2 p-1.5 rounded-lg text-left hover:bg-bg/50 transition-colors"
          aria-label="Профиль"
        >
          <div className="relative flex-shrink-0">
            <Avatar size="xs">Д</Avatar>
            <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-bg-elevated" />
          </div>
          <div className="hidden sm:flex flex-col items-start leading-tight">
            <span className="text-sm font-medium text-text-primary">Исакова Дарья</span>
            <span className="text-[11px] text-text-muted">Администратор</span>
          </div>
          <Icon name="chevron-down" size={16} className="text-text-muted shrink-0" />
        </button>
      </div>
    </header>
  );
};
