import React from "react";

import SearchIcon from "../../assets/icons/search.svg?react";
import StarIcon from "../../assets/icons/star.svg?react";
import PinIcon from "../../assets/icons/pin.svg?react";
import AtIcon from "../../assets/icons/at.svg?react";
import SmileIcon from "../../assets/icons/smile.svg?react";
import PenIcon from "../../assets/icons/pen.svg?react";
import FolderIcon from "../../assets/icons/folder.svg?react";
import FolderOpenIcon from "../../assets/icons/folder_open.svg?react";
import FoldersIcon from "../../assets/icons/folders.svg?react";
import PlusIcon from "../../assets/icons/plus.svg?react";
import AddIcon from "../../assets/icons/add.svg?react";
import PhoneIcon from "../../assets/icons/phone.svg?react";
import SendIcon from "../../assets/icons/send.svg?react";
import ProfileIcon from "../../assets/icons/profile.svg?react";
import CloseIcon from "../../assets/icons/close.svg?react";
import BellIcon from "../../assets/icons/bell.svg?react";
import ChannelsIcon from "../../assets/icons/channels.svg?react";
import MoreIcon from "../../assets/icons/more.svg?react";
import HeartIcon from "../../assets/icons/heart.svg?react";
import ThumbsUpIcon from "../../assets/icons/thumbs-up.svg?react";
import ChevronDownIcon from "../../assets/icons/chevron-down.svg?react";
import ChevronUpIcon from "../../assets/icons/chevron-up.svg?react";
import ChevronRightIcon from "../../assets/icons/chevron-right.svg?react";
import GridIcon from "../../assets/icons/grid.svg?react";
import HomeIcon from "../../assets/icons/home.svg?react";
import FlagIcon from "../../assets/icons/flag.svg?react";
import AttachIcon from "../../assets/icons/attach.svg?react";
import ChatBubbleIcon from "../../assets/icons/chat_bubble.svg?react";
import CalendarIcon from "../../assets/icons/calendar.svg?react";
import MailIcon from "../../assets/icons/mail.svg?react";
import GroupIcon from "../../assets/icons/group.svg?react";
import NewWindowIcon from "../../assets/icons/new_window.svg?react";
import MarkerIcon from "../../assets/icons/marker.svg?react";
import AlternateEmailIcon from "../../assets/icons/alternate_email.svg?react";
import MoodIcon from "../../assets/icons/mood.svg?react";
import DraftsIcon from "../../assets/icons/drafts.svg?react";
import MoreVertIcon from "../../assets/icons/more_vert.svg?react";
import ImagesIcon from "../../assets/icons/images.svg?react";
import VideosIcon from "../../assets/icons/videos.svg?react";
import FilesIcon from "../../assets/icons/files.svg?react";
import LinksIcon from "../../assets/icons/links.svg?react";
import FullscreenIcon from "../../assets/icons/fullscreen.svg?react";
import FullscreenExitIcon from "../../assets/icons/fullscreen_exit.svg?react";

type SvgComponent = React.FC<React.SVGProps<SVGSVGElement>>;

const ICONS: Record<string, SvgComponent> = {
  home: HomeIcon,
  flag: FlagIcon,
  attach: AttachIcon,
  search: SearchIcon,
  star: StarIcon,
  pin: PinIcon,
  at: AtIcon,
  smile: SmileIcon,
  pen: PenIcon,
  folder: FolderIcon,
  folder_open: FolderOpenIcon,
  folders: FoldersIcon,
  plus: PlusIcon,
  add: AddIcon,
  phone: PhoneIcon,
  send: SendIcon,
  profile: ProfileIcon,
  close: CloseIcon,
  bell: BellIcon,
  channels: ChannelsIcon,
  more: MoreIcon,
  heart: HeartIcon,
  "thumbs-up": ThumbsUpIcon,
  "chevron-down": ChevronDownIcon,
  "chevron-up": ChevronUpIcon,
  "chevron-right": ChevronRightIcon,
  grid: GridIcon,
  chatBubble: ChatBubbleIcon,
  calendar: CalendarIcon,
  mail: MailIcon,
  group: GroupIcon,
  newWindow: NewWindowIcon,
  marker: MarkerIcon,
  alternate_email: AlternateEmailIcon,
  mood: MoodIcon,
  drafts: DraftsIcon,
  moreVert: MoreVertIcon,
  images: ImagesIcon,
  videos: VideosIcon,
  files: FilesIcon,
  links: LinksIcon,
  fullscreen: FullscreenIcon,
  fullscreen_exit: FullscreenExitIcon,
};

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  className = "",
}) => {
  const SvgIcon = ICONS[name];
  if (!SvgIcon) return null;
  return (
    <SvgIcon
      width={size}
      height={size}
      className={`shrink-0 ${className}`.trim()}
      aria-hidden
    />
  );
};
