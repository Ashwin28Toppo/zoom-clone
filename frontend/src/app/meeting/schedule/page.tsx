"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { createScheduledMeeting } from "@/lib/api";
import "@/styles/dashboard.css";
import "@/styles/schedule.css";

export default function ScheduleMeetingPage() {
  const router = useRouter();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split("T")[0];

  // Core Form State
  const [topic, setTopic] = useState("My Meeting");
  const [showDescription, setShowDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [timeHour, setTimeHour] = useState("1:00");
  const [timeAmPm, setTimeAmPm] = useState("PM");
  const [durationHours, setDurationHours] = useState("0");
  const [durationMins, setDurationMins] = useState("40");
  const [timezone, setTimezone] = useState("(GMT-7:00) Pacific Time (US and Canada)");

  const [hostVideo, setHostVideo] = useState<"on" | "off">("off");
  const [participantVideo, setParticipantVideo] = useState<"on" | "off">("off");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!topic.trim()) {
      setErrorMessage("Meeting topic is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      // Parse time into 24-hr format
      const [hStr, mStr] = timeHour.split(":");
      let hour = parseInt(hStr, 10);
      const minute = parseInt(mStr || "0", 10);
      if (timeAmPm === "PM" && hour < 12) hour += 12;
      if (timeAmPm === "AM" && hour === 12) hour = 0;

      const [year, month, day] = date.split("-").map(Number);
      const scheduledDateTime = new Date(Date.UTC(year, month - 1, day, hour, minute));

      const totalDuration = parseInt(durationHours, 10) * 60 + parseInt(durationMins, 10);

      await createScheduledMeeting({
        title: topic.trim(),
        description: description.trim() || undefined,
        scheduled_at: scheduledDateTime.toISOString(),
        duration: Math.max(15, totalDuration || 40),
        host_name: "Ashwin Toppo",
      });

      // Redirect back to dashboard where upcoming meetings list updates
      router.push("/dashboard");
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : "Failed to schedule meeting";
      setErrorMessage(msg);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#ffffff" }}>
      {/* Top Header */}
      <Navbar variant="portal" />

      <div className="zm-schedule-page">
        {/* Left Navigation Sidebar */}
        <aside className="zm-schedule-sidebar">
          <div className="zm-sched-side-group">
            <Link href="/dashboard" className="zm-sched-side-item">
              <span>Home</span>
            </Link>

            <Link href="/meetings" className="zm-sched-side-item active">
              <span>Meetings</span>
            </Link>
          </div>
        </aside>

        {/* Main Schedule Form Content */}
        <main className="zm-schedule-main">
          <Link href="/dashboard" className="zm-back-link">
            ‹ Back to Meetings
          </Link>

          <h1 className="zm-schedule-title">Schedule Meeting</h1>

          {errorMessage && (
            <div className="zm-error-banner" style={{ margin: "0 0 24px 0" }}>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSave}>
            {/* Topic Field */}
            <div className="zm-form-row">
              <label className="zm-form-row-label" htmlFor="sched-topic">
                <span className="required">*</span> Topic
              </label>
              <div className="zm-form-row-content">
                <input
                  id="sched-topic"
                  type="text"
                  className="zm-sched-input"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                />
                {!showDescription ? (
                  <button
                    type="button"
                    className="zm-add-desc-btn"
                    onClick={() => setShowDescription(true)}
                  >
                    + Add Description
                  </button>
                ) : (
                  <textarea
                    className="zm-sched-input"
                    style={{ minHeight: 70, resize: "vertical" }}
                    placeholder="Enter meeting agenda or notes..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                )}
              </div>
            </div>

            {/* When Field */}
            <div className="zm-form-row">
              <label className="zm-form-row-label" htmlFor="sched-date">
                When
              </label>
              <div className="zm-form-row-content">
                <div className="zm-datetime-group">
                  <input
                    id="sched-date"
                    type="date"
                    className="zm-sched-select"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                  <select
                    id="sched-time-select"
                    className="zm-sched-select"
                    style={{ maxHeight: 220, overflowY: "auto" }}
                    value={timeHour}
                    onChange={(e) => setTimeHour(e.target.value)}
                  >
                    {[
                      "12:00", "12:15", "12:30", "12:45",
                      "1:00", "1:15", "1:30", "1:45",
                      "2:00", "2:15", "2:30", "2:45",
                      "3:00", "3:15", "3:30", "3:45",
                      "4:00", "4:15", "4:30", "4:45",
                      "5:00", "5:15", "5:30", "5:45",
                      "6:00", "6:15", "6:30", "6:45",
                      "7:00", "7:15", "7:30", "7:45",
                      "8:00", "8:15", "8:30", "8:45",
                      "9:00", "9:15", "9:30", "9:45",
                      "10:00", "10:15", "10:30", "10:45",
                      "11:00", "11:15", "11:30", "11:45"
                    ].map((timeOpt) => (
                      <option key={timeOpt} value={timeOpt}>
                        {timeOpt}
                      </option>
                    ))}
                  </select>
                  <select
                    className="zm-sched-select"
                    value={timeAmPm}
                    onChange={(e) => setTimeAmPm(e.target.value)}
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Duration Field */}
            <div className="zm-form-row">
              <label className="zm-form-row-label">Duration</label>
              <div className="zm-form-row-content">
                <div className="zm-datetime-group">
                  <select
                    className="zm-sched-select"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                  >
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                  <span style={{ fontSize: 13, color: "#6e7687" }}>hr</span>

                  <select
                    className="zm-sched-select"
                    value={durationMins}
                    onChange={(e) => setDurationMins(e.target.value)}
                  >
                    <option value="15">15</option>
                    <option value="30">30</option>
                    <option value="40">40</option>
                    <option value="45">45</option>
                    <option value="60">60</option>
                  </select>
                  <span style={{ fontSize: 13, color: "#6e7687" }}>min</span>
                </div>
              </div>
            </div>

            {/* Time Zone Field */}
            <div className="zm-form-row">
              <label className="zm-form-row-label" htmlFor="sched-tz">
                Time Zone
              </label>
              <div className="zm-form-row-content">
                <select
                  id="sched-tz"
                  className="zm-sched-select"
                  style={{ maxWidth: 420 }}
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  <option value="(GMT-7:00) Pacific Time (US and Canada)">
                    (GMT-7:00) Pacific Time (US and Canada)
                  </option>
                  <option value="(GMT-4:00) Eastern Time (US and Canada)">
                    (GMT-4:00) Eastern Time (US and Canada)
                  </option>
                  <option value="(GMT+0:00) UTC">
                    (GMT+0:00) Universal Coordinated Time
                  </option>
                  <option value="(GMT+5:30) India Standard Time">
                    (GMT+5:30) India Standard Time
                  </option>
                </select>
              </div>
            </div>

            {/* Meeting ID Field */}
            <div className="zm-form-row">
              <label className="zm-form-row-label">Meeting ID</label>
              <div className="zm-form-row-content">
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#334155" }}>
                  <span style={{ fontWeight: 500 }}>Generate Automatically</span>
                  <span style={{ fontSize: 13, color: "#64748b" }}>
                    (A unique 12-digit Meeting ID and shareable link will be created)
                  </span>
                </div>
              </div>
            </div>


            {/* Video Settings Field */}
            <div className="zm-form-row">
              <label className="zm-form-row-label">Video</label>
              <div className="zm-form-row-content">
                <div className="zm-video-settings-grid">
                  <span>Host</span>
                  <div style={{ display: "flex", gap: 16 }}>
                    <label className="zm-radio-option">
                      <input
                        type="radio"
                        name="hostVideo"
                        checked={hostVideo === "on"}
                        onChange={() => setHostVideo("on")}
                      />
                      <span>on</span>
                    </label>
                    <label className="zm-radio-option">
                      <input
                        type="radio"
                        name="hostVideo"
                        checked={hostVideo === "off"}
                        onChange={() => setHostVideo("off")}
                      />
                      <span>off</span>
                    </label>
                  </div>

                  <span>Participant</span>
                  <div style={{ display: "flex", gap: 16 }}>
                    <label className="zm-radio-option">
                      <input
                        type="radio"
                        name="participantVideo"
                        checked={participantVideo === "on"}
                        onChange={() => setParticipantVideo("on")}
                      />
                      <span>on</span>
                    </label>
                    <label className="zm-radio-option">
                      <input
                        type="radio"
                        name="participantVideo"
                        checked={participantVideo === "off"}
                        onChange={() => setParticipantVideo("off")}
                      />
                      <span>off</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="zm-sched-footer">
              <button
                id="btn-schedule-save"
                type="submit"
                className="zm-sched-save-btn"
                disabled={isSubmitting || !topic.trim()}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </button>
              <Link href="/dashboard" className="zm-sched-cancel-btn">
                Cancel
              </Link>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
