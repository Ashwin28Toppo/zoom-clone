"use client";

import React, { useState } from "react";
import Link from "next/link";
import { createScheduledMeeting } from "@/lib/api";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMeetingScheduled: () => void;
}

export default function ScheduleModal({
  isOpen,
  onClose,
  onMeetingScheduled,
}: ScheduleModalProps) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split("T")[0];

  const [title, setTitle] = useState("My Meeting");
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("45");
  const [hostVideo, setHostVideo] = useState<"on" | "off">("off");
  const [participantVideo, setParticipantVideo] = useState<"on" | "off">("off");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      setErrorMessage("Meeting topic is required.");
      return;
    }
    if (!date || !time) {
      setErrorMessage("Please select both a valid date and time.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const scheduledDateTime = new Date(`${date}T${time}:00`);
      if (isNaN(scheduledDateTime.getTime())) {
        setErrorMessage("Invalid date or time selected.");
        setIsSubmitting(false);
        return;
      }

      await createScheduledMeeting({
        title: title.trim(),
        description: description.trim() || undefined,
        scheduled_at: scheduledDateTime.toISOString(),
        duration: parseInt(duration, 10),
        host_name: "Ashwin Toppo",
      });

      // Clear & trigger refresh
      setTitle("My Meeting");
      setDescription("");
      onMeetingScheduled();
      onClose();
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : "Failed to schedule meeting";
      setErrorMessage(msg);
    }
  }

  return (
    <div className="zm-modal-backdrop" onClick={onClose}>
      <div className="zm-modal-card" style={{ maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 className="zm-modal-title" style={{ margin: 0 }}>Schedule Meeting</h2>
          <Link
            href="/meeting/schedule"
            onClick={onClose}
            style={{ fontSize: 13, color: "#0e71eb", textDecoration: "none", fontWeight: 600 }}
          >
            Full Page ↗
          </Link>
        </div>

        <form onSubmit={handleSubmit}>
          {errorMessage && (
            <div className="zm-error-banner" style={{ margin: "0 0 16px 0" }}>
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="zm-form-group">
            <label className="zm-form-label" htmlFor="input-sched-title">
              Topic *
            </label>
            <input
              id="input-sched-title"
              type="text"
              className="zm-input"
              placeholder="Meeting Topic"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
            {!showDescription ? (
              <button
                type="button"
                className="zm-add-desc-btn"
                style={{ marginTop: 6 }}
                onClick={() => setShowDescription(true)}
              >
                + Add Description
              </button>
            ) : (
              <textarea
                className="zm-input"
                style={{ minHeight: 60, marginTop: 8, resize: "vertical" }}
                placeholder="Meeting agenda or notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="zm-form-group">
              <label className="zm-form-label" htmlFor="input-sched-date">
                When *
              </label>
              <input
                id="input-sched-date"
                type="date"
                className="zm-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="zm-form-group">
              <label className="zm-form-label" htmlFor="input-sched-time">
                Start Time *
              </label>
              <input
                id="input-sched-time"
                type="time"
                className="zm-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="zm-form-group">
            <label className="zm-form-label" htmlFor="select-sched-duration">
              Duration
            </label>
            <select
              id="select-sched-duration"
              className="zm-input"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="40">40 minutes (Basic Plan Limit)</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
            </select>
          </div>

          <div className="zm-notice-box" style={{ margin: "12px 0 16px" }}>
            <span className="zm-notice-icon">⚠</span>
            <div style={{ fontSize: 12 }}>
              <span>You can schedule meetings for up to 40 minutes each with your current Basic plan.</span>
            </div>
          </div>

          {/* Video Settings */}
          <div className="zm-form-group">
            <label className="zm-form-label">Video</label>
            <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#6e7687" }}>Host:</span>
                <label className="zm-radio-option">
                  <input
                    type="radio"
                    name="modalHostVideo"
                    checked={hostVideo === "on"}
                    onChange={() => setHostVideo("on")}
                  />
                  <span>on</span>
                </label>
                <label className="zm-radio-option">
                  <input
                    type="radio"
                    name="modalHostVideo"
                    checked={hostVideo === "off"}
                    onChange={() => setHostVideo("off")}
                  />
                  <span>off</span>
                </label>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#6e7687" }}>Participant:</span>
                <label className="zm-radio-option">
                  <input
                    type="radio"
                    name="modalPartVideo"
                    checked={participantVideo === "on"}
                    onChange={() => setParticipantVideo("on")}
                  />
                  <span>on</span>
                </label>
                <label className="zm-radio-option">
                  <input
                    type="radio"
                    name="modalPartVideo"
                    checked={participantVideo === "off"}
                    onChange={() => setParticipantVideo("off")}
                  />
                  <span>off</span>
                </label>
              </div>
            </div>
          </div>

          <div className="zm-modal-footer">
            <button
              type="button"
              className="zm-modal-btn cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              id="btn-confirm-schedule"
              type="submit"
              className="zm-modal-btn primary"
              disabled={isSubmitting || !title.trim()}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
