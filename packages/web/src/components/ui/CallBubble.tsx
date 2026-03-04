import React from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

interface CallBubbleProps {
  callName?: string;
  topic?: string;
  duration?: string;
}

export const CallBubble: React.FC<CallBubbleProps> = ({
  callName = "Название звонка",
  topic = "Тема 2",
  duration = "0:47",
}) => {
  return (
    <div className="flex gap-2 px-4 py-2 hover:bg-bg-elevated/30">
      <Avatar size="sm" className="bg-bg-elevated text-green-500">
        <Icon name="phone" size={18} className="text-current" />
      </Avatar>
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary truncate">
            Звонок {callName} | #{topic}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">{duration}</p>
        </div>
        <div className="flex -space-x-1.5 flex-shrink-0">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-6 h-6 rounded-full bg-bg-elevated border-2 border-bg flex items-center justify-center text-[10px] text-text-muted"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
