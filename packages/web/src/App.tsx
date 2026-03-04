import React from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ChatPage } from "./components/ChatPage";
import { CalendarPage } from "./components/CalendarPage";
import { MailPage } from "./components/MailPage";
import { CallsPage } from "./components/CallsPage";

const DEFAULT_STREAM = "general";

const App: React.FC = () => {
  const location = useLocation();
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/stream/${DEFAULT_STREAM}`} replace />} />
      <Route element={<Layout />}>
        <Route path="/stream/:streamName" element={<ChatPage key={location.pathname} />} />
        <Route path="/stream/:streamName/topic/:topicName" element={<ChatPage key={location.pathname} />} />
        <Route path="/dm/:dmId" element={<ChatPage key={location.pathname} />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/mail" element={<MailPage />} />
        <Route path="/calls" element={<CallsPage />} />
      </Route>
    </Routes>
  );
};

export default App;
