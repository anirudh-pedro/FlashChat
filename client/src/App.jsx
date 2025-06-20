import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import JoinPage from "./pages/JoinPage";
import ChatPage from "./pages/ChatPage";
import NotFound from "./pages/NotFound";

const App = () => {
  return (
    <Router>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-900 pt-safe-top pb-safe-bottom">
        <Routes>
          <Route path="/" element={<Navigate to="/join" />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
