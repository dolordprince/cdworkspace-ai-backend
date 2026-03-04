import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation, Outlet } from "react-router-dom";
import { fetchStreams, fetchFolders, type MockMessage, type MockStream, type MockFolder } from "../lib/zulipClient";
import { Sidebar } from "./ui/Sidebar";
import { FolderRail } from "./ui/FolderRail";
import { RightDrawer } from "./ui/RightDrawer";
import { RightPanel, type RightPanelUserInfo } from "./ui/RightPanel";
import { getDmById } from "./ui/Sidebar/data";
import { TopBar, type TopBarSection } from "./ui/TopBar";
import { SearchModal } from "./SearchModal";
import { ProfileDrawer } from "./ProfileDrawer";
import { OpenSearchContext } from "../contexts/OpenSearchContext";
import { RightDrawerContext } from "../contexts/RightDrawerContext";

function getSectionFromPathname(pathname: string): TopBarSection {
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/mail")) return "mail";
  if (pathname.startsWith("/calls")) return "calls";
  return "chat";
}

const DEFAULT_STREAM = "general";

export const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { streamName, topicName, dmId: dmIdParam } = useParams<{
    streamName?: string;
    topicName?: string;
    dmId?: string;
  }>();
  const activeStream = streamName ?? undefined;
  const activeTopic = topicName ?? null;
  const activeDmId = dmIdParam ? parseInt(dmIdParam, 10) : undefined;

  const [streams, setStreams] = useState<MockStream[]>([]);
  const [folders, setFolders] = useState<MockFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("1");
  const [searchOpen, setSearchOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(true);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);

  useEffect(() => {
    if (folders.length > 0 && !folders.some((f) => f.id === selectedFolderId)) {
      setSelectedFolderId(folders[0].id);
    }
  }, [folders, selectedFolderId]);
  const openSearch = React.useCallback(() => setSearchOpen(true), []);

  useEffect(() => {
    let cancelled = false;
    fetchStreams().then((s) => {
      if (!cancelled) setStreams(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchFolders().then((f) => {
      if (!cancelled) setFolders(f);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectStream = (name?: string) => {
    if (name) navigate(`/stream/${name}`);
    else navigate("/");
  };

  const handleSelectDm = (id: number | null) => {
    if (id != null) navigate(`/dm/${id}`);
    else navigate("/");
  };

  const handleSearchSelectMessage = (msg: MockMessage) => {
    const stream = msg.channel ?? "general";
    const topic = msg.subject ?? "general";
    navigate(`/stream/${stream}/topic/${encodeURIComponent(topic)}`);
  };

  const activeSection = getSectionFromPathname(location.pathname);
  const handleSectionChange = (section: TopBarSection) => {
    if (section === "chat") navigate(`/stream/${DEFAULT_STREAM}`);
    else navigate(`/${section}`);
  };

  const rightDrawerTitle =
    activeDmId != null && !Number.isNaN(activeDmId)
      ? "Личный диалог"
      : activeStream
        ? `#${activeStream}`
        : "Название чата";

  const dmChat = activeDmId != null && !Number.isNaN(activeDmId) ? getDmById(activeDmId) : undefined;
  const rightPanelUser: RightPanelUserInfo | undefined = dmChat
    ? {
        name: dmChat.name,
        lastSeen: "35 мин назад",
        phone: "+7 (999) 999-99-99",
        username: "@name",
        role: "Генеральный директор",
        birthday: "25 июля 1977 (48 лет)",
        media: { photos: 36, videos: 5, files: 42, links: 4 },
        commonGroups: [
          {
            name: "Название группового ча...",
            lastMessage: "Текст последнего сообщения",
            unread: 458,
          },
        ],
      }
    : undefined;

  return (
    <OpenSearchContext.Provider value={openSearch}>
      <RightDrawerContext.Provider
        value={{ open: rightDrawerOpen, setOpen: setRightDrawerOpen }}
      >
        <div className="h-screen min-h-[400px] max-h-[100dvh] bg-bg text-text-primary flex flex-col items-stretch overflow-hidden">
          <SearchModal
            open={searchOpen}
            onOpenChange={setSearchOpen}
            onSelectMessage={handleSearchSelectMessage}
          />
          <ProfileDrawer open={profileDrawerOpen} onOpenChange={setProfileDrawerOpen} />
          <TopBar
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
            onOpenSearch={openSearch}
            onOpenProfile={() => setProfileDrawerOpen(true)}
          />
          <div className="flex-1 flex min-h-0 items-stretch justify-center">
            <div className="w-full max-w-[1920px] flex min-h-0 min-w-0 gap-1">
              {activeSection === "chat" && (
                <>
                  <FolderRail
                    folders={folders}
                    selectedFolderId={selectedFolderId}
                    onSelectFolder={setSelectedFolderId}
                  />
                  <Sidebar
                    streams={streams}
                    selectedFolderId={selectedFolderId}
                    activeStream={activeStream}
                    activeTopic={activeTopic}
                    activeDmId={activeDmId ?? null}
                    onSelectStream={handleSelectStream}
                    onSelectDm={handleSelectDm}
                  />
                </>
              )}
              <main className="flex-1 flex min-h-0 min-w-0 items-stretch justify-start overflow-hidden">
                <Outlet />
              </main>
              {activeSection === "chat" && rightDrawerOpen && (
                <RightDrawer onClose={() => setRightDrawerOpen(false)}>
                  <RightPanel
                    title={rightDrawerTitle}
                    participantsCount={5}
                    onlineCount={2}
                    user={rightPanelUser}
                  />
                </RightDrawer>
              )}
            </div>
          </div>
        </div>
      </RightDrawerContext.Provider>
    </OpenSearchContext.Provider>
  );
};
