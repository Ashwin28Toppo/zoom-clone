"use client";

import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import DashboardClock from "@/components/DashboardClock";
import ActionButtons from "@/components/ActionButtons";
import MeetingList from "@/components/MeetingList";
import JoinModal from "@/components/JoinModal";
import "@/styles/dashboard.css";

export default function DashboardPage() {
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [refreshTrigger] = useState(0);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar onOpenJoin={() => setIsJoinOpen(true)} />

      <div className="zm-app-body">
        <Sidebar />

        <main className="zm-main-content">
          <DashboardClock />

          <ActionButtons
            onOpenJoin={() => setIsJoinOpen(true)}
          />

          <MeetingList refreshTrigger={refreshTrigger} />
        </main>
      </div>

      <JoinModal
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
      />
    </div>
  );
}
