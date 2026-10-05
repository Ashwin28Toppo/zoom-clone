"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import DashboardClock from "@/components/DashboardClock";
import ActionButtons from "@/components/ActionButtons";
import MeetingList from "@/components/MeetingList";
import JoinModal from "@/components/JoinModal";
import { useAuth } from "@/lib/auth-context";
import "@/styles/dashboard.css";

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Protect dashboard — redirect unauthenticated users to login
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // Show nothing while checking auth
  if (isLoading || !isAuthenticated) return null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar onOpenJoin={() => setIsJoinOpen(true)} />

      <div className="zm-app-body">
        <Sidebar />

        <main className="zm-main-content">
          <DashboardClock />

          <ActionButtons
            onOpenJoin={() => setIsJoinOpen(true)}
            onMeetingCreated={() => setRefreshTrigger((n) => n + 1)}
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
