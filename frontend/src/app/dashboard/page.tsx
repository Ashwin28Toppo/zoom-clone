"use client";

import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import DashboardClock from "@/components/DashboardClock";
import ActionButtons from "@/components/ActionButtons";
import MeetingList from "@/components/MeetingList";
import JoinModal from "@/components/JoinModal";
import ScheduleModal from "@/components/ScheduleModal";
import "@/styles/dashboard.css";

export default function DashboardPage() {
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  function handleMeetingScheduled() {
    setRefreshTrigger((prev) => prev + 1);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <div className="zm-app-body">
        <Sidebar />

        <main className="zm-main-content">
          <DashboardClock />

          <ActionButtons
            onOpenJoin={() => setIsJoinOpen(true)}
            onOpenSchedule={() => setIsScheduleOpen(true)}
          />

          <MeetingList refreshTrigger={refreshTrigger} />
        </main>
      </div>

      <JoinModal
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
      />

      <ScheduleModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        onMeetingScheduled={handleMeetingScheduled}
      />
    </div>
  );
}
