"use client";

import React, { use } from "react";
import Link from "next/link";

interface MeetingRoomProps {
  params: Promise<{ meetingId: string }>;
}

export default function MeetingRoomPage({ params }: MeetingRoomProps) {
  const resolvedParams = use(params);
  const meetingId = resolvedParams.meetingId;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#121212", color: "#ffffff", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #2a2a2a" }}>
        <div style={{ fontWeight: 600 }}>Meeting: {meetingId}</div>
        <Link href="/dashboard" style={{ color: "#ff4d4f", textDecoration: "none", fontWeight: 600 }}>Leave</Link>
      </header>
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#8c8c8c" }}>Meeting room interface will be fully rendered in Phase 7</p>
      </main>
    </div>
  );
}
