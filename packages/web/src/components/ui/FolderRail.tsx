import React from "react";
import { Icon } from "./Icon";
import { Badge } from "./Badge";

export interface FolderRailFolder {
  id: string;
  label: string;
  badge?: number;
}

interface FolderRailProps {
  folders: FolderRailFolder[];
  selectedFolderId: string;
  onSelectFolder: (id: string) => void;
}

export const FolderRail: React.FC<FolderRailProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
}) => {
  return (
    <div className="flex-shrink-0 w-[90px] flex flex-col items-center py-3 gap-1">
      {folders.map((folder, index) => {
        const isSelected = selectedFolderId === folder.id;
        const iconName = index === 0 ? "folders" : isSelected ? "folder_open" : "folder";
        const textColor = isSelected ? "text-white" : "text-[#707070]";
        return (
          <div key={folder.id} className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => onSelectFolder(folder.id)}
              className={`relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors border border-transparent ${textColor} ${
                !isSelected ? "hover:bg-bg/60" : ""
              }`}
              title={folder.label}
            >
              <Icon name={iconName} size={40} className={`shrink-0 ${textColor}`} />
              {folder.badge !== undefined && (
                <span className="absolute -top-0.5 -right-0.5">
                  <Badge count={folder.badge} variant="unread" />
                </span>
              )}
            </button>
            <span
              className={`text-[11px] text-center max-w-[78px] truncate ${textColor}`}
              title={folder.label}
            >
              {folder.label}
            </span>
          </div>
        );
      })}
      <div className="flex-1 min-h-2" />
      <button
        type="button"
        className="flex items-center justify-center w-10 h-10 rounded-lg border border-dashed border-border-subtle text-text-muted hover:border-accent hover:text-accent hover:bg-bg/50"
        aria-label="Добавить папку"
      >
        <Icon name="add" size={40} className="shrink-0" />
      </button>
    </div>
  );
};
