import React from "react";
import { Icon } from "./ui/Icon";

export const CallsPage: React.FC = () => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-text-muted">
      <Icon name="phone" size={64} className="opacity-50" />
      <h2 className="text-xl font-medium text-text-primary">Звонки</h2>
      <p className="text-center text-sm">Раздел в разработке</p>
    </div>
  );
};
