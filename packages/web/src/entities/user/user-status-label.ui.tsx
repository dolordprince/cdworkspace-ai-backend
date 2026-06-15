import React from "react";
import { useUserStatusEmojiDisplay } from "./user-status.hooks";
import type { UserStatus } from "./user.model";

export interface UserStatusLabelProps {
  status: UserStatus | null | undefined;
  className?: string;
  textClassName?: string;
  emojiClassName?: string;
  fallbackLabel?: string;
}

export const UserStatusLabel = React.memo<UserStatusLabelProps>(function UserStatusLabel({
  status,
  className = "",
  textClassName = "",
  emojiClassName = "",
  fallbackLabel,
}) {
  const emojiDisplay = useUserStatusEmojiDisplay(status);
  const text = status?.text.trim() ?? "";
  const label = text.length > 0 ? text : (fallbackLabel ?? "");
  const hasVisibleLabel = label.length > 0;
  if (emojiDisplay == null && label.length === 0) {
    return null;
  }

  let emojiNode: React.ReactNode = null;
  if (emojiDisplay?.kind === "image") {
    emojiNode = hasVisibleLabel ? (
      <img
        src={emojiDisplay.src}
        alt=""
        title={emojiDisplay.alt}
        className={`h-4 w-4 shrink-0 rounded-sm object-contain ${emojiClassName}`}
        aria-hidden
      />
    ) : (
      <img
        src={emojiDisplay.src}
        alt={emojiDisplay.alt}
        title={emojiDisplay.alt}
        className={`h-4 w-4 shrink-0 rounded-sm object-contain ${emojiClassName}`}
      />
    );
  } else if (emojiDisplay?.kind === "text") {
    emojiNode = (
      <span className={`shrink-0 ${emojiClassName}`} aria-hidden>
        {emojiDisplay.text}
      </span>
    );
  }

  return (
    <span className={`inline-flex min-w-0 items-center gap-1 ${className}`}>
      {emojiNode}
      {hasVisibleLabel ? <span className={`truncate ${textClassName}`}>{label}</span> : null}
    </span>
  );
});
