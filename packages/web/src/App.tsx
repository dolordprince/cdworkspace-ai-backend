import React from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useInstancesStore } from "./stores/instancesStore";
import { Layout } from "./components/Layout";
import { LoginPage } from "./components/LoginPage";
import { ChatPage } from "./components/ChatPage";
import { ActivityPage } from "./components/ActivityPage";
import { CalendarPage } from "./components/CalendarPage";
import { MailPage } from "./components/MailPage";
import { CallsPage } from "./components/CallsPage";

const DEFAULT_STREAM = "general";

const App: React.FC = () => {
  const location = useLocation();
  const instances = useInstancesStore((s) => s.instances);

  if (instances.length === 0) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to={`/stream/${DEFAULT_STREAM}`} replace />} />
      <Route element={<Layout />}>
        <Route path="/stream/:streamSlug" element={<ChatPage key={location.pathname} />} />
        <Route path="/stream/:streamSlug/topic/:topicName" element={<ChatPage key={location.pathname} />} />
        <Route path="/dm/:dmId" element={<ChatPage key={location.pathname} />} />
        <Route path="/activity/:filter" element={<ActivityPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/mail" element={<MailPage />} />
        <Route path="/calls" element={<CallsPage />} />
      </Route>
    </Routes>
  );
};

export default App;
