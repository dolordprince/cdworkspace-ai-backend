import React from "react";

const SIZE_CLASS = {
  xs: "w-9 h-9 text-xs",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-xs",
  lg: "w-12 h-12 text-lg",
} as const;

interface AvatarProps {
  size?: keyof typeof SIZE_CLASS;
  children: React.ReactNode;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  size = "md",
  children,
  className = "",
}) => {
  return (
    <div
      className={`flex-shrink-0 rounded-full bg-bg border border-border-subtle flex items-center justify-center overflow-hidden font-semibold text-text-primary ${SIZE_CLASS[size]} ${className}`.trim()}
    >
      {children}
    </div>
  );
};
