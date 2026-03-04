import React from "react";

const VARIANT_CLASS = {
  muted:
    "bg-bg-elevated text-text-muted border-0",
  unread: "bg-sidebar-unread text-white border-0",
} as const;

interface BadgeProps {
  count: number;
  variant?: keyof typeof VARIANT_CLASS;
  /** Для больших чисел (например 458) — слегка скруглённый прямоугольник */
  rounded?: "full" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  count,
  variant = "unread",
  rounded = "full",
}) => {
  const roundedClass = rounded === "full" ? "rounded-full" : "rounded-md";
  return (
    <span
      className={`min-w-[20px] h-5 flex items-center justify-center px-1.5 text-[11px] font-medium ${roundedClass} ${VARIANT_CLASS[variant]}`}
    >
      {count}
    </span>
  );
};
