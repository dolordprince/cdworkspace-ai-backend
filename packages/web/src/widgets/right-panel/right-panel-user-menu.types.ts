import type { IconName } from "~/shared/ui/icon";
import type { ReactNode } from "react";

export interface RightPanelUserMenuProps {
  heading?: string;
  onOpenAboutDrawer?: () => void;
  onOpenBuildsDrawer?: () => void;
}

export interface MenuButtonProps {
  label: string;
  icon: IconName;
  subtitle?: ReactNode;
  right?: ReactNode;
  onClick: () => void;
}

export interface OptionButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}
