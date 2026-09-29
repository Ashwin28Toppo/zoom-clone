"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getMeetingById } from "@/lib/api";

interface JoinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function JoinModal({ isOpen, onClose }: JoinModalProps) {
  const router = useRouter();
  const [meetingInput, setMeetingInput] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  function extractMeetingId(input: string): string {
    const trimmed = input.trim();
    // If user pasted a full URL or route like /meeting/123456789001
    const match = trimmed.match(/\/meeting\/([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return match[1];
    }
    // Remove common separators like hyphens and spaces
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

      // Meeting is valid -> navigate to pre-join screen
      onClose();
      router.push(`/meeting/${meeting.meeting_id}/prejoin`);
    } catch (err: unknown) {
      setIsValidating(false);
      const msg = err instanceof Error ? err.message : "Meeting not found";
      setErrorMessage(msg.includes("404") || msg.toLowerCase().includes("not found")
        ? "Meeting ID not found. Please check the ID and try again."
        : msg
      );
    }
  }

  return (
    <div className="zm-modal-backdrop" onClick={onClose}>
      <div className="zm-modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="zm-modal-title">Join Meeting</h2>

        <form onSubmit={handleJoinSubmit}>
          <div className="zm-form-group">
            <label className="zm-form-label" htmlFor="input-meeting-id">
              Meeting ID or Personal Link Name
            </label>
            <input
              id="input-meeting-id"
              type="text"
              className={`zm-input ${errorMessage ? "zm-input-error" : ""}`}
              placeholder="Enter 12-digit Meeting ID"
              value={meetingInput}
              onChange={(e) => {
                setMeetingInput(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              autoFocus
              disabled={isValidating}
            />
            {errorMessage && <span className="zm-error-text">{errorMessage}</span>}
          </div>

          <div className="zm-modal-footer">
            <button
              type="button"
              className="zm-modal-btn cancel"
              onClick={onClose}
              disabled={isValidating}
            >
              Cancel
            </button>
            <button
              id="btn-confirm-join"
              type="submit"
              className="zm-modal-btn primary"
              disabled={!meetingInput.trim() || isValidating}
            >
              {isValidating ? "Validating..." : "Join"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
