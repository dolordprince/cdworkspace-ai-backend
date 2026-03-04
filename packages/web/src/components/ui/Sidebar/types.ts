export type SidebarChat =
  | { type: "stream"; stream_id: number; name: string }
  | {
      type: "dm";
      id: number;
      name: string;
      isGroup?: boolean;
      lastMessage?: string;
      time?: string;
      badge?: number;
      pinned?: boolean;
    };

export interface SidebarProps {
  streams: { stream_id: number; name: string }[];
  selectedFolderId: string;
  activeStream?: string;
  activeTopic?: string | null;
  activeDmId?: number | null;
  onSelectStream: (name?: string) => void;
  onSelectDm?: (id: number | null) => void;
}
