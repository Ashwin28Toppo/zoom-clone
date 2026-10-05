"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { getUpcomingMeetings, createInstantMeeting, Meeting } from "@/lib/api";
import "@/styles/dashboard.css";
import "@/styles/workplace_tabs.css";

export default function MeetingsListPage() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>("PMI");
  const [isCopied, setIsCopied] = useState(false);
  const [showFullInvite, setShowFullInvite] = useState(false);
  const pmi = "916 333 2813";

  const loadMeetings = React.useCallback(async () => {
    try {
      const data = await getUpcomingMeetings();
      setUpcomingMeetings(data.meetings || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    getUpcomingMeetings()
      .then((data) => {
        if (isMounted) {
          setUpcomingMeetings(data.meetings || []);
        }
      })
      .catch(() => {
        // ignore
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleStartPMI() {
    try {
      const m = await createInstantMeeting("Ashwin Toppo's Personal Meeting");
      startTransition(() => {
        router.push(`/meeting/${m.meeting_id}/prejoin`);
      });
    } catch {
      alert("Failed to start meeting.");
    }
  }

  function handleCopyInvite() {
    const inviteText = `Ashwin Toppo is inviting you to a scheduled Zoom meeting.\n\nTopic: My Personal Meeting ID (PMI)\nMeeting ID: ${pmi}\nJoin URL: ${window.location.origin}/dashboard`;
    navigator.clipboard.writeText(inviteText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#ffffff" }}>
      <Navbar variant="workplace" />

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Sidebar activeTab="meetings" />

        <div className="zm-workplace-container" style={{ flex: 1 }}>
          {/* Middle Sub-Sidebar (Left panel matching Image 2) */}
          <aside className="zm-sub-sidebar">
            <div className="zm-meetings-sub-header">
              <button
                type="button"
                className="zm-sub-icon-btn"
                title="Refresh"
                onClick={loadMeetings}
              >
                🔄
              </button>
              <span className="zm-meetings-sub-title">Upcoming</span>
            </div>

            <div className="zm-meetings-cards-list">
              {/* Selected Solid Blue PMI Card matching Image 2 */}
              <div
                className="zm-pmi-card"
                onClick={() => setSelectedMeetingId("PMI")}
              >
                <span className="zm-pmi-card-id">{pmi}</span>
                <span className="zm-pmi-card-label">My Personal Meeting ID (PMI)</span>
              </div>

              <div className="zm-meetings-divider-label">Today</div>

              {/* Dynamic / Seed Scheduled Meetings Cards */}
              {upcomingMeetings.length > 0 ? (
                upcomingMeetings.map((m) => (
                  <div
                    key={m.id}
                    className="zm-sched-meeting-card"
                    style={{
                      borderColor: selectedMeetingId === m.meeting_id ? "#0e71eb" : "#e5e8ec",
                    }}
                    onClick={() => setSelectedMeetingId(m.meeting_id)}
                  >
                    <div className="zm-sched-card-title">{m.title}</div>
                    <div className="zm-sched-card-time">
                      {m.scheduled_at ? new Date(m.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Scheduled"} ({m.duration} min)
                    </div>
                    <div className="zm-sched-card-meta">Host: {m.host_name}</div>
                    <div className="zm-sched-card-meta">Meeting ID: {m.meeting_id}</div>
                  </div>
                ))
              ) : (
                <div
                  className="zm-sched-meeting-card"
                  onClick={() => setSelectedMeetingId("sample")}
                >
                  <div className="zm-sched-card-title">My Meeting</div>
                  <div className="zm-sched-card-time">1:30 AM - 2:10 AM</div>
                  <div className="zm-sched-card-meta">Host: Ashwin Toppo</div>
                  <div className="zm-sched-card-meta">Meeting ID: 767 6547 7339</div>
                </div>
              )}
            </div>
          </aside>

          {/* Right Main Panel matching Image 2 */}
          <main className="zm-workplace-main">
            <div className="zm-meetings-detail-panel">
              <h1 className="zm-detail-main-title">
                {selectedMeetingId === "PMI" ? "My Personal Meeting ID (PMI)" : "My Meeting"}
              </h1>

              <div className="zm-detail-meeting-id">
                {selectedMeetingId === "PMI" ? pmi : selectedMeetingId}
              </div>

              {/* Action Buttons matching Image 2 */}
              <div className="zm-detail-actions-row">
                <button
                  type="button"
                  className="zm-detail-btn-start"
                  onClick={handleStartPMI}
                >
                  Start
                </button>

                <button
                  type="button"
                  className="zm-detail-btn-secondary"
                  onClick={handleCopyInvite}
                >
                  <span>📋</span>
                  <span>{isCopied ? "Copied!" : "Copy Invitation"}</span>
                </button>

                <button
                  type="button"
                  className="zm-detail-btn-secondary"
                  onClick={() => router.push("/meeting/schedule")}
                >
                  <span>✏️</span>
                  <span>Edit</span>
                </button>
              </div>

              <button
                type="button"
                className="zm-detail-link"
                style={{ background: "none", border: "none", padding: 0, textAlign: "left" }}
                onClick={() => setShowFullInvite((prev) => !prev)}
              >
                {showFullInvite ? "Hide Meeting Invitation" : "Show Meeting Invitation"}
              </button>

              {showFullInvite && (
                <div style={{ padding: 16, backgroundColor: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  Ashwin Toppo is inviting you to a scheduled Zoom meeting.{"\n"}
                  Topic: My Personal Meeting ID (PMI){"\n"}
                  Meeting ID: {pmi}{"\n"}
                  Passcode: 123456{"\n"}
                  One tap mobile: +16465588656,,{pmi.replace(/\s/g, "")}#
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
