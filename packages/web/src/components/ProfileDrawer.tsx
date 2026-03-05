import React from "react";
import { useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { Icon } from "./ui/Icon";
import type { IconName } from "./ui/Icon";

interface ProfileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MenuItem {
  label: string;
  subtitle?: string;
  icon?: IconName;
  right?: React.ReactNode;
  highlighted?: boolean;
  destructive?: boolean;
  /** При клике — переход по маршруту и закрытие шторки */
  navigateTo?: string;
}

const PROFILE_ITEMS: MenuItem[] = [
  { label: "Добавить сервер Zulip", icon: "add", navigateTo: "/login" },
  { label: "Личная информация", icon: "profile" },
  { label: "Версия приложения", icon: "grid", subtitle: "1.9.2" },
  {
    label: "Вышла новая версия",
    subtitle: "Установите новую версию прямо сейчас",
    highlighted: true,
  },
  {
    label: "Выбрать сборку",
    icon: "newWindow",
    subtitle: "Выберите версию для установки или отк...",
    right: <Icon name="chevron-right" size={16} className="text-white/70 shrink-0" />,
  },
  {
    label: "Звук уведомлений",
    icon: "bell",
    right: (
      <span className="flex items-center gap-1 text-sm text-white">
        Pop
        <Icon name="chevron-down" size={16} className="text-current" />
      </span>
    ),
  },
  {
    label: "Язык",
    icon: "alternate_email",
    right: (
      <span className="flex items-center gap-1 text-sm text-white">
        Русский
        <Icon name="chevron-down" size={16} className="text-current" />
      </span>
    ),
  },
  { label: "Настройки темы", icon: "mood" },
  {
    label: "Сортировка чатов",
    icon: "moreVert",
    subtitle: "Настройте приоритет непрочитанных чатов.",
  },
  { label: "Logs", icon: "drafts" },
  {
    label: "Выйти",
    icon: "chevron-right",
    destructive: true,
  },
];

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({ open, onOpenChange }) => {
  const navigate = useNavigate();

  const handleItemClick = (item: MenuItem) => {
    if (item.navigateTo) {
      navigate(item.navigateTo);
      onOpenChange(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed top-0 right-0 bottom-0 w-full max-w-[360px] bg-[#333333] shadow-xl z-50 flex flex-col outline-none"
          onPointerDownOutside={() => onOpenChange(false)}
          onEscapeKeyDown={() => onOpenChange(false)}
        >
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-white">Профиль</h2>
          <Dialog.Close
            asChild
            className="p-2 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Закрыть"
          >
            <button type="button">
              <Icon name="close" size={20} className="text-current" />
            </button>
          </Dialog.Close>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          <ul className="px-3 space-y-0.5">
            {PROFILE_ITEMS.map((item, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors ${
                    item.highlighted
                      ? "bg-white/10 hover:bg-white/15"
                      : item.destructive
                        ? "hover:bg-red-500/10 text-red-400"
                        : "hover:bg-white/10 text-white"
                  } ${item.destructive ? "text-red-400" : ""}`}
                >
                  {item.icon && (
                    <span
                      className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${
                        item.destructive ? "bg-red-500/20" : "bg-white/10"
                      }`}
                    >
                      <Icon
                        name={item.icon}
                        size={20}
                        className={item.destructive ? "text-red-400" : "text-white"}
                      />
                    </span>
                  )}
                  {!item.icon && item.highlighted && (
                    <span className="w-9 h-9 shrink-0 rounded-full bg-white/10" />
                  )}
                  <div className="min-w-0 flex-1 flex flex-col items-start">
                    <span
                      className={`text-sm font-medium ${item.destructive ? "text-red-400" : "text-white"}`}
                    >
                      {item.label}
                    </span>
                    {item.subtitle && (
                      <span className="text-[12px] text-white/60 mt-0.5">{item.subtitle}</span>
                    )}
                  </div>
                  {item.right && <div className="shrink-0">{item.right}</div>}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
