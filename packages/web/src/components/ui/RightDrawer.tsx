import React from "react";
import { Icon } from "./Icon";

interface RightDrawerProps {
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Шторка справа от контента. Фон #333333, скругление 12px, отступ от блока с чатом 4px.
 * Внутрь можно поместить любой контент (информация о канале, о собеседнике, настройки и т.д.).
 */
export const RightDrawer: React.FC<RightDrawerProps> = ({ onClose, children }) => {
  return (
    <aside
      className="relative flex-shrink-0 w-[315px] min-h-0 flex flex-col overflow-hidden rounded-[12px] bg-[#333333] px-[8px] py-[20px]"
      role="complementary"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute w-4 h-4 flex items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
        style={{ top: 20, right: 16 }}
        aria-label="Закрыть"
      >
        <Icon name="close" size={16} className="text-current" />
      </button>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </div>
    </aside>
  );
};
