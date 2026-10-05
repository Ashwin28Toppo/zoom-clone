"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Meeting, getUpcomingMeetings, getRecentMeetings } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";


interface MeetingListProps {
  refreshTrigger: number;
}

export default function MeetingList({ refreshTrigger }: MeetingListProps) {
  const router = useRouter();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<"upcoming" | "recent">("upcoming");
  const [upcoming, setUpcoming] = useState<Meeting[]>([]);
  const [recent, setRecent] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const [upcomingRes, recentRes] = await Promise.all([
        getUpcomingMeetings(token),
        getRecentMeetings(token),
      ]);
      setUpcoming(upcomingRes.meetings);
      setRecent(recentRes.meetings);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load meetings";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [token]);


  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!token) { setIsLoading(false); return; }
      try {
        setErrorMessage(null);
        const [upcomingRes, recentRes] = await Promise.all([
          getUpcomingMeetings(token),
          getRecentMeetings(token),
        ]);
        if (isMounted) {
          setUpcoming(upcomingRes.meetings);
          setRecent(recentRes.meetings);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Failed to load meetings";
          setErrorMessage(msg);
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  function handleCopyInvite(meetingId: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${origin}/meeting/${meetingId}/prejoin`;
    const inviteText = `Join Zoom Meeting\nMeeting ID: ${meetingId}\nLink: ${inviteUrl}`;
    navigator.clipboard.writeText(inviteText);
    setCopiedId(meetingId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleStartMeeting(meetingId: string) {
    router.push(`/meeting/${meetingId}/prejoin`);
  }

  function formatMeetingTime(isoDate?: string | null): { time: string; durationLabel: string } {
    if (!isoDate) return { time: "Now", durationLabel: "" };
    try {
      const d = new Date(isoDate);
      const time = d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const date = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return { time, durationLabel: date };
    } catch {
      return { time: "--:--", durationLabel: "" };
    }
  }

  const currentList = activeTab === "upcoming" ? upcoming : recent;

  return (
    <div className="zm-meetings-card">
      {/* Calendar Notice Banner */}
      <div className="zm-calendar-banner" style={{ backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }}>
        <svg className="zm-banner-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span className="zm-banner-text" style={{ color: "#15803d" }}>
          Direct meeting links & instant invites are active. Participants can join directly via link or Meeting ID.
        </span>
      </div>

      {/* Tabs Header */}
      <div className="zm-meetings-header">
        <div className="zm-tabs">
          <button
            className={`zm-tab-btn ${activeTab === "upcoming" ? "active" : ""}`}
            onClick={() => setActiveTab("upcoming")}
          >
            <span>Upcoming Meetings</span>
            <span className={`zm-tab-badge ${activeTab === "upcoming" ? "" : "inactive"}`}>
              {upcoming.length}
            </span>
          </button>
          <button
            className={`zm-tab-btn ${activeTab === "recent" ? "active" : ""}`}
            onClick={() => setActiveTab("recent")}
          >
            <span>Recent Meetings</span>
            <span className={`zm-tab-badge ${activeTab === "recent" ? "" : "inactive"}`}>
              {recent.length}
            </span>
          </button>
        </div>

        <div className="zm-meetings-actions">
          <button
            className="zm-refresh-btn"
            onClick={handleRefresh}
            title="Refresh meetings from server"
            disabled={isLoading}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ animation: isLoading ? "zmSpin 0.8s linear infinite" : "none" }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="zm-error-banner">
          <span>Failed to connect to backend: {errorMessage}</span>
          <button
            onClick={handleRefresh}
            style={{
              background: "none",
              border: "1px solid currentColor",
              borderRadius: "4px",
              padding: "2px 8px",
              cursor: "pointer",
              color: "inherit",
              fontSize: "12px",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="zm-state-container">
          <div className="zm-spinner" />
          <span className="zm-state-desc">Loading your meetings...</span>
        </div>
      ) : currentList.length === 0 ? (
        /* Empty state */
        <div className="zm-state-container">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#a0aec0" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <div className="zm-state-title">
            {activeTab === "upcoming" ? "No upcoming meetings" : "No recent meetings"}
          </div>
          <div className="zm-state-desc">
            {activeTab === "upcoming"
              ? "You do not have any meetings scheduled. Click Schedule to set up a meeting."
              : "Completed meetings will show up here after they conclude."}
          </div>
        </div>
      ) : (
        /* Meeting items list */
        <div className="zm-meeting-list">
          {currentList.map((m) => {
            const timeInfo = formatMeetingTime(m.scheduled_at);
            const isCopied = copiedId === m.meeting_id;

            return (
              <div key={m.meeting_id} className="zm-meeting-item">
                <div className="zm-meeting-left">
                  <div className="zm-meeting-time-box">
                    <div className="zm-meeting-time">{timeInfo.time}</div>
                    <div className="zm-meeting-duration">
                      {timeInfo.durationLabel ? `${timeInfo.durationLabel} • ` : ""}
                      {m.duration} min
                    </div>
                  </div>

                  <div className="zm-meeting-info">
                    <div className="zm-meeting-title">{m.title}</div>
                    <div className="zm-meeting-meta">
                      <span>ID: <code className="zm-meeting-id-pill">{m.meeting_id}</code></span>
                      <span>Host: {m.host_name}</span>
                      {m.description && <span>• {m.description}</span>}
                    </div>
                  </div>
                </div>

                <div className="zm-meeting-right">
                  <button
                    className={`zm-copy-link-btn ${isCopied ? "copied" : ""}`}
                    onClick={() => handleCopyInvite(m.meeting_id)}
                    title="Copy meeting invite link to clipboard"
                  >
                    {isCopied ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    className="zm-join-btn"
                    onClick={() => handleStartMeeting(m.meeting_id)}
                  >
                    {activeTab === "upcoming" ? "Start" : "Rejoin"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
