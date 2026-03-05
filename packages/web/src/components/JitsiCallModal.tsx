import React, { useRef, useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { JitsiMeeting } from "@jitsi/react-sdk";
import { parseJitsiUrl } from "../lib/jitsi";
import { useChatListStore } from "../stores/chatListStore";
import { useUsersStore } from "../stores/usersStore";
import { useCallParticipantsStore } from "../stores/callParticipantsStore";
import { Icon } from "./ui/Icon";

/** Минимальный тип для Jitsi External API. */
type JitsiExternalApi = {
  getNumberOfParticipants: () => number;
  getParticipantsInfo: () => object[];
  on: (event: string, callback: () => void) => void;
};

interface JitsiCallModalProps {
  open: boolean;
  meetingUrl: string;
  onClose: () => void;
}

function useParticipantCount(open: boolean, _parsed: { domain: string; roomName: string } | null) {
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const apiRef = useRef<JitsiExternalApi | null>(null);

  const updateCount = () => {
    const n = apiRef.current?.getNumberOfParticipants?.();
    if (typeof n === "number") setParticipantCount(n);
  };

  const onApiReady = (api: JitsiExternalApi) => {
    apiRef.current = api;
    setParticipantCount(api.getNumberOfParticipants());
    api.on("participantJoined", updateCount);
    api.on("participantLeft", updateCount);
  };

  useEffect(() => {
    if (!open) {
      apiRef.current = null;
      setParticipantCount(null);
    }
  }, [open]);

  return { participantCount, onApiReady };
}

export const JitsiCallModal: React.FC<JitsiCallModalProps> = ({
  open,
  meetingUrl,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLElement | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const parsed = meetingUrl ? parseJitsiUrl(meetingUrl) : null;
  const { participantCount, onApiReady } = useParticipantCount(open, parsed);
  const setParticipants = useCallParticipantsStore((s) => s.setParticipants);
  const clearParticipants = useCallParticipantsStore((s) => s.clearParticipants);
  const participantPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentUserId = useChatListStore((s) => s.currentUserId);
  const getUser = useUsersStore((s) => s.getUser);
  const currentUser = currentUserId != null ? getUser(currentUserId) : undefined;
  const displayName =
    (currentUser?.full_name?.trim() || "Участник") || "Участник";

  useEffect(() => {
    if (!open) {
      setIsMinimized(false);
      if (document.fullscreenElement === fullscreenRef.current) {
        document.exitFullscreen?.();
      }
      setIsNativeFullscreen(false);
      if (participantPollIntervalRef.current) {
        clearInterval(participantPollIntervalRef.current);
        participantPollIntervalRef.current = null;
      }
      if (meetingUrl) clearParticipants(meetingUrl);
    }
  }, [open, meetingUrl, clearParticipants]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsNativeFullscreen(document.fullscreenElement === fullscreenRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const el = iframeRef.current;
    if (!el || !("style" in el)) return;
    (el as HTMLElement).style.width = "100%";
    (el as HTMLElement).style.height = "100%";
    (el as HTMLElement).style.minHeight = isMinimized ? "0" : "400px";
  }, [isMinimized]);

  const headerTitle =
    participantCount !== null
      ? `Звонок (${participantCount} ${participantCount === 1 ? "участник" : participantCount < 5 ? "участника" : "участников"})`
      : "Звонок";

  const handleOpenChange = (o: boolean) => {
    if (!o && !isMinimized) setIsMinimized(true);
  };

  const handleApiReady = (api: JitsiExternalApi) => {
    onApiReady(api);
    const updateParticipants = () => {
      try {
        const list = api.getParticipantsInfo?.() ?? [];
        const participants = list.map((p: { displayName?: string; displayname?: string; id?: string }) => ({
          displayName:
            (p as { displayName?: string }).displayName ??
            (p as { displayname?: string }).displayname ??
            "Участник",
        }));
        setParticipants(meetingUrl, participants);
      } catch {
        // ignore
      }
    };
    updateParticipants();
    participantPollIntervalRef.current = setInterval(updateParticipants, 5000);
  };

  const toggleNativeFullscreen = async () => {
    if (!fullscreenRef.current) return;
    try {
      if (document.fullscreenElement === fullscreenRef.current) {
        await document.exitFullscreen?.();
      } else {
        await fullscreenRef.current.requestFullscreen?.();
      }
    } catch {
      // Fullscreen API not supported or denied (e.g. not from user gesture in some browsers)
    }
  };

  const contentPositionClass = isMinimized
    ? "fixed right-4 bottom-4 z-[60] w-[320px] h-[220px] rounded-xl"
    : "fixed inset-4 sm:inset-8 z-50 rounded-xl";

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        {!isMinimized && (
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        )}
        <Dialog.Content
          className={`flex flex-col bg-bg-elevated border border-border-subtle shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ${contentPositionClass}`}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            if (isMinimized) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (isMinimized) e.preventDefault();
          }}
        >
          <div
            ref={fullscreenRef}
            className="flex flex-col flex-1 min-h-0 bg-bg-elevated overflow-hidden rounded-xl"
          >
            <div className="flex-shrink-0 flex items-center justify-between px-2 py-1.5 sm:px-4 sm:py-2 border-b border-border-subtle">
              <span className="text-xs sm:text-sm font-semibold text-text-primary truncate min-w-0">
                {headerTitle}
              </span>
              <div className="flex items-center gap-0.5 shrink-0">
                {!isMinimized && (
                  <button
                    type="button"
                    onClick={toggleNativeFullscreen}
                    className="p-1.5 sm:p-2 rounded-lg text-text-muted hover:bg-bg/50 hover:text-text-primary"
                    aria-label={isNativeFullscreen ? "Выйти из полноэкранного" : "Полноэкранный режим браузера"}
                    title={isNativeFullscreen ? "Выйти из полноэкранного" : "Полноэкранный режим браузера"}
                  >
                    <Icon
                      name={isNativeFullscreen ? "fullscreen_exit" : "fullscreen"}
                      size={18}
                      className="text-current"
                    />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (isMinimized) {
                      setIsMinimized(false);
                    } else {
                      setIsMinimized(true);
                      if (document.fullscreenElement === fullscreenRef.current) {
                        document.exitFullscreen?.();
                      }
                    }
                  }}
                className="p-1.5 sm:p-2 rounded-lg text-text-muted hover:bg-bg/50 hover:text-text-primary"
                aria-label={isMinimized ? "Развернуть" : "Свернуть"}
                title={isMinimized ? "Развернуть" : "Свернуть в окно"}
              >
                <Icon
                  name={isMinimized ? "chevron-up" : "chevron-down"}
                  size={18}
                  className="text-current"
                />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-lg text-text-muted hover:bg-bg/50 hover:text-text-primary"
                aria-label="Закрыть звонок"
              >
                <Icon name="close" size={18} className="text-current" />
              </button>
            </div>
          </div>
            <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden">
            {open && parsed && (
              <JitsiMeeting
                domain={parsed.domain}
                roomName={parsed.roomName}
                onApiReady={handleApiReady}
                getIFrameRef={(ref) => {
                  iframeRef.current = ref;
                  if (ref && containerRef.current) {
                    ref.style.width = "100%";
                    ref.style.height = "100%";
                    ref.style.minHeight = isMinimized ? "0" : "400px";
                  }
                }}
                onReadyToClose={onClose}
                userInfo={{ displayName, email: "" }}
                configOverwrite={{
                  startWithAudioMuted: true,
                  startWithVideoMuted: true,
                  prejoinConfig: { enabled: false },
                }}
                interfaceConfigOverwrite={{
                  DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
                }}
              />
            )}
            {open && !parsed && meetingUrl && (
              <div className="absolute inset-0 flex items-center justify-center text-text-muted text-sm">
                Неверная ссылка на звонок
              </div>
            )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
