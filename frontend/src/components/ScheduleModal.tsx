"use client";

import React, { useState } from "react";
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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("60");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      setErrorMessage("Meeting topic/title is required.");
      return;
    }
    if (!date || !time) {
      setErrorMessage("Please select both a valid date and time.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      // Combine date and time to ISO format
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

      // Clear form & trigger refresh
      setTitle("");
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
      <div className="zm-modal-card" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <h2 className="zm-modal-title">Schedule Meeting</h2>

        <form onSubmit={handleSubmit}>
          {errorMessage && (
            <div className="zm-error-banner" style={{ margin: "0 0 16px 0" }}>
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="zm-form-group">
            <label className="zm-form-label" htmlFor="input-sched-title">
              Topic / Title *
            </label>
            <input
              id="input-sched-title"
              type="text"
              className="zm-input"
              placeholder="e.g. Q4 Strategy Review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="zm-form-group">
            <label className="zm-form-label" htmlFor="input-sched-desc">
              Description (optional)
            </label>
            <textarea
              id="input-sched-desc"
              className="zm-input"
              style={{ minHeight: 64, resize: "vertical" }}
              placeholder="Meeting agenda, topics, or notes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="zm-form-group">
              <label className="zm-form-label" htmlFor="input-sched-date">
                Date *
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
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
            </select>
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
              {isSubmitting ? "Scheduling..." : "Save Meeting"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
