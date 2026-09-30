"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getMeetingById } from "@/lib/api";

interface JoinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HistoryItem {
  id: string;
  topic: string;
  displayId: string;
}

const DEFAULT_HISTORY: HistoryItem[] = [
  { id: "73019270061", topic: "Ashwin Toppo's Zoom Meeting", displayId: "730 1927 0061" },
  { id: "76765477339", topic: "My Meeting", displayId: "767 6547 7339" },
  { id: "74589748132", topic: "Ashwin Toppo's Zoom Meeting", displayId: "745 8974 8132" },
  { id: "96663897001", topic: "My Meeting", displayId: "966 6389 7001" },
  { id: "76376514753", topic: "Ashwin Toppo's Zoom Meeting", displayId: "763 7651 4753" },
  { id: "73130555113", topic: "Ashwin Toppo's Zoom Meeting", displayId: "731 3055 5113" },
];

export default function JoinModal({ isOpen, onClose }: JoinModalProps) {
  const router = useRouter();
  const [meetingInput, setMeetingInput] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(DEFAULT_HISTORY);

  if (!isOpen) return null;

  function extractMeetingId(input: string): string {
    const trimmed = input.trim();
    const match = trimmed.match(/\/meeting\/([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed.replace(/[-\s]/g, "");
  }

  async function handleJoinSubmit(e: React.FormEvent) {
    e.preventDefault();
    const meetingId = extractMeetingId(meetingInput);

    if (!meetingId) {
      setErrorMessage("Please enter a valid Meeting ID or personal link.");
      return;
    }

    try {
      setIsValidating(true);
      setErrorMessage(null);

      // Validate that meeting exists via backend API
      const meeting = await getMeetingById(meetingId);

      if (meeting.status === "ended") {
        setErrorMessage("This meeting has already ended.");
        setIsValidating(false);
        return;
      }

      onClose();
      router.push(`/meeting/${meeting.meeting_id}/prejoin`);
    } catch (err: unknown) {
      setIsValidating(false);
      const msg = err instanceof Error ? err.message : "Meeting not found";
      setErrorMessage(
        msg.includes("404") || msg.toLowerCase().includes("not found")
          ? "Meeting ID not found. Please check the ID and try again."
          : msg
      );
    }
  }

  function handleSelectHistory(item: HistoryItem) {
    setMeetingInput(item.displayId);
    setIsDropdownOpen(false);
    if (errorMessage) setErrorMessage(null);
  }

  return (
    <div className="zm-join-modal-backdrop" onClick={onClose}>
      <div
        className={`zm-join-modal-card ${isDropdownOpen ? "expanded" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="zm-join-modal-title">Join Meeting</h2>

        <form onSubmit={handleJoinSubmit}>
          <div className="zm-join-form-group">
            <label className="zm-join-form-label" htmlFor="input-meeting-id">
              Meeting ID or Personal Link Name
            </label>

            {/* Input with Caret Toggle Button */}
            <div className={`zm-join-input-wrap ${isDropdownOpen ? "open" : ""}`}>
              <input
                id="input-meeting-id"
                type="text"
                className={`zm-join-input ${isDropdownOpen ? "open" : ""} ${errorMessage ? "error" : ""}`}
                value={meetingInput}
                onChange={(e) => {
                  setMeetingInput(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoFocus
                disabled={isValidating}
                autoComplete="off"
              />
              <button
                type="button"
                className={`zm-join-caret-circle-btn ${isDropdownOpen ? "active" : ""}`}
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                title="Toggle history"
              >
                {isDropdownOpen ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15"></polyline>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                )}
              </button>
            </div>

            {/* Dropdown rendered inside document flow of card, matching Image 2 */}
            {isDropdownOpen && history.length > 0 && (
              <div className="zm-join-history-card-box">
                {history.map((item, idx) => (
                  <div
                    key={item.id + idx}
                    className={`zm-join-history-row ${idx === selectedIndex ? "highlighted" : ""}`}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => handleSelectHistory(item)}
                  >
                    <span className="zm-join-history-row-topic">{item.topic}</span>
                    <span className="zm-join-history-row-id">{item.displayId}</span>
                  </div>
                ))}

                <div
                  className="zm-join-history-row-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHistory([]);
                    setIsDropdownOpen(false);
                  }}
                >
                  Clear History
                </div>
              </div>
            )}

            {errorMessage && <span className="zm-join-error-text">{errorMessage}</span>}
          </div>

          {/* Bottom Right Actions - Visible when dropdown is closed, matching Image 1 */}
          {!isDropdownOpen && (
            <div className="zm-join-modal-footer">
              <button
                type="button"
                className="zm-join-btn-cancel"
                onClick={onClose}
                disabled={isValidating}
              >
                Cancel
              </button>
              <button
                id="btn-confirm-join"
                type="submit"
                className="zm-join-btn-submit"
                disabled={!meetingInput.trim() || isValidating}
              >
                {isValidating ? "Validating..." : "Join"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
