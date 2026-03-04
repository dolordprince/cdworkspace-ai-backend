import React from "react";
import { Icon } from "./ui/Icon";

export const MailPage: React.FC = () => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-text-muted">
      <Icon name="mail" size={64} className="opacity-50" />
      <h2 className="text-xl font-medium text-text-primary">Почта</h2>
      <p className="text-center text-sm">Раздел в разработке</p>
    </div>
  );
};
