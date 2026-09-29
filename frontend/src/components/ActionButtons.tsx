"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createInstantMeeting } from "@/lib/api";

interface ActionButtonsProps {
  onOpenJoin: () => void;
  onOpenSchedule: () => void;
}

export default function ActionButtons({ onOpenJoin, onOpenSchedule }: ActionButtonsProps) {
  const router = useRouter();
  const [isCreatingInstant, setIsCreatingInstant] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleNewMeeting() {
    try {
      setIsCreatingInstant(true);
      setErrorMessage(null);
      const meeting = await createInstantMeeting("Ashwin Toppo's Zoom Meeting", "Ashwin Toppo");
      // Navigate to pre-join screen
      router.push(`/meeting/${meeting.meeting_id}/prejoin`);
    } catch (err: unknown) {
      setIsCreatingInstant(false);
      const msg = err instanceof Error ? err.message : "Failed to create meeting";
      setErrorMessage(msg);
    }
  }

  return (
    <>
      {errorMessage && (
        <div className="zm-error-banner">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: "bold" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Primary Action Buttons matching Zoom screenshot */}
      <section className="zm-action-row">
        {/* New Meeting */}
        <div className="zm-action-item">
          <button
            id="btn-new-meeting"
            className="zm-action-btn orange"
            onClick={handleNewMeeting}
            disabled={isCreatingInstant}
            title="Start an instant meeting"
            aria-label="New meeting"
          >
            {isCreatingInstant ? (
              <div
                style={{
                  width: 22,
                  height: 22,
                  border: "3px solid rgba(255,255,255,0.4)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  animation: "zmSpin 0.8s linear infinite",
                }}
              />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 10l5-4v12l-5-4" />
                <rect x="2" y="6" width="13" height="12" rx="2" />
              </svg>
            )}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="zm-action-label">New meeting</span>
            <button
              className="zm-action-dropdown-btn"
              onClick={handleNewMeeting}
              title="New meeting options"
              aria-label="New meeting options"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Join Meeting */}
        <div className="zm-action-item">
          <button
            id="btn-join-meeting"
            className="zm-action-btn blue"
            onClick={onOpenJoin}
            title="Join a meeting by Meeting ID"
            aria-label="Join meeting"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <span className="zm-action-label">Join</span>
        </div>

        {/* Schedule Meeting */}
        <div className="zm-action-item">
          <button
            id="btn-schedule-meeting"
            className="zm-action-btn indigo"
            onClick={onOpenSchedule}
            title="Schedule a future meeting"
            aria-label="Schedule meeting"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <text x="12" y="18" textAnchor="middle" fontSize="8" fill="currentColor" fontWeight="700">
                19
              </text>
            </svg>
          </button>
          <span className="zm-action-label">Schedule</span>
        </div>
      </section>

      {/* Sub-Actions Row matching Zoom screenshot */}
      <section className="zm-subactions-row">
        <div className="zm-subaction-pill">
          <span style={{ color: "#e02828", fontSize: "16px" }}>●</span>
          <span>Recordings</span>
        </div>
        <div className="zm-subaction-pill">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0e71eb" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span>Summaries</span>
        </div>
        <div className="zm-subaction-pill">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7852ff" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <span>My Notes</span>
        </div>
      </section>
    </>
  );
}
