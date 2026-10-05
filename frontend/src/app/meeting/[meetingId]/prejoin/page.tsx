"use client";

import React, { use, useState, useEffect, useRef, useTransition, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getMeetingById, joinMeeting, Meeting } from "@/lib/api";
import "@/styles/dashboard.css";
import "@/styles/prejoin.css";

interface PrejoinPageProps {
  params: Promise<{ meetingId: string }>;
}

function PrejoinContent({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Meeting State
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoadingMeeting, setIsLoadingMeeting] = useState(true);
  const [meetingError, setMeetingError] = useState<string | null>(null);

  // Pre-join Form State
  const [displayName, setDisplayName] = useState("Ashwin Toppo");
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Media Preview State
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [mediaPermissionDenied, setMediaPermissionDenied] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isJoiningRef = useRef(false);

  // 1. Fetch Meeting
  useEffect(() => {
    let isMounted = true;

    async function loadMeeting() {
      try {
        setIsLoadingMeeting(true);
        setMeetingError(null);

        const data = await getMeetingById(meetingId);
        if (!isMounted) return;

        if (data.status === "ended") {
          setMeetingError("This meeting has already ended.");
          setIsLoadingMeeting(false);
          return;
        }

        setMeeting(data);
        setIsLoadingMeeting(false);
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Meeting not found";
          setMeetingError(
            msg.toLowerCase().includes("not found") || msg.includes("404")
              ? `Meeting with ID "${meetingId}" was not found.`
              : msg
          );
          setIsLoadingMeeting(false);
        }
      }
    }

    loadMeeting();
    return () => { isMounted = false; };
  }, [meetingId]);

  // 2. Request Media Preview
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      if (el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
      }
      el.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (isLoadingMeeting || meetingError) return;

    let active = true;

    async function setupMedia() {
      try {
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } catch {
            stream = null;
          }
        }

        if (!active) {
          if (stream) stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (stream) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
          setMediaPermissionDenied(false);
        } else {
          setMediaPermissionDenied(true);
          setIsVideoOn(false);
          setIsAudioOn(false);
        }
      } catch {
        if (active) {
          setMediaPermissionDenied(true);
          setIsVideoOn(false);
          setIsAudioOn(false);
        }
      }
    }

    setupMedia();

    const cleanup = () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };

    window.addEventListener("beforeunload", cleanup);
    return () => {
      window.removeEventListener("beforeunload", cleanup);
      cleanup();
    };
  }, [isLoadingMeeting, meetingError]);

  // 3. Toggle Local Mic Track
  function toggleAudio() {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isAudioOn;
      });
    }
    setIsAudioOn((prev) => !prev);
  }

  // 4. Toggle Local Camera Track
  function toggleVideo() {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoOn;
      });
    }
    setIsVideoOn((prev) => !prev);
  }

  // 5. Handle Final Join
  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (isJoiningRef.current) return;
    if (!displayName.trim()) {
      setJoinError("Please enter your display name.");
      return;
    }

    try {
      isJoiningRef.current = true;
      setIsJoining(true);
      setJoinError(null);

      const participant = await joinMeeting(meetingId, {
        display_name: displayName.trim(),
        is_audio_on: isAudioOn,
        is_video_on: isVideoOn,
      });

      if (typeof window !== "undefined") {
        sessionStorage.setItem(`zoom_participant_${meetingId}`, JSON.stringify(participant));
        sessionStorage.setItem(
          `zoom_media_initial_${meetingId}`,
          JSON.stringify({ isAudioOn, isVideoOn, displayName: displayName.trim() })
        );
      }

      // Stop preview stream before entering room
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      startTransition(() => {
        router.push(`/meeting/${meetingId}`);
      });
    } catch (err: unknown) {
      isJoiningRef.current = false;
      setIsJoining(false);
      const msg = err instanceof Error ? err.message : "Failed to join meeting";
      setJoinError(msg);
    }
  }

  return (
    <div className="zm-prejoin-page">
      <Navbar variant="portal" />

      <div className="zm-prejoin-body">
        <Link href="/dashboard" className="zm-prejoin-back">
          ‹ Back to Dashboard
        </Link>

        {isLoadingMeeting ? (
          <div className="zm-prejoin-center-msg">
            <span style={{ fontSize: 18, color: "#8c93a0" }}>Loading meeting information...</span>
          </div>
        ) : meetingError ? (
          <div className="zm-prejoin-center-msg">
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚠</div>
            <h2 style={{ fontSize: 22, color: "#ffffff", margin: "0 0 8px 0" }}>Cannot Join Meeting</h2>
            <p style={{ color: "#a0aec0", maxWidth: 440, margin: "0 0 20px 0" }}>{meetingError}</p>
            <Link href="/dashboard" className="zm-prejoin-btn-join" style={{ textDecoration: "none", display: "inline-block", width: "auto", padding: "10px 24px" }}>
              Back to Dashboard
            </Link>
          </div>
        ) : (
          /* Pre-Join Lobby */
          <div className="zm-prejoin-content">
            {/* Left: Video Preview */}
            <div className="zm-preview-container">
              <video
                ref={attachVideo}
                autoPlay
                playsInline
                muted
                className="zm-preview-video"
                style={{ display: isVideoOn && !mediaPermissionDenied ? "block" : "none" }}
              />

              {(!isVideoOn || mediaPermissionDenied) && (
                <div className="zm-preview-avatar-fallback">
                  <div className="zm-preview-avatar">
                    {displayName.trim() ? displayName.trim().charAt(0).toUpperCase() : "U"}
                  </div>
                  <span className="zm-preview-off-label">
                    {mediaPermissionDenied ? "Camera permission not granted" : "Your video is turned off"}
                  </span>
                </div>
              )}

              {/* Floating Toolbar on Preview Card */}
              <div className="zm-preview-toolbar">
                <button
                  type="button"
                  className={`zm-preview-btn ${!isAudioOn ? "muted" : ""}`}
                  onClick={toggleAudio}
                  title={isAudioOn ? "Mute Microphone" : "Unmute Microphone"}
                  id="prejoin-btn-mic"
                >
                  {isAudioOn ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                  <span>{isAudioOn ? "Mute" : "Unmute"}</span>
                </button>

                <button
                  type="button"
                  className={`zm-preview-btn ${!isVideoOn ? "muted" : ""}`}
                  onClick={toggleVideo}
                  title={isVideoOn ? "Stop Video" : "Start Video"}
                  id="prejoin-btn-video"
                >
                  {isVideoOn ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M21 15.5l-5-3.5v-5l5-3.5v12zM2 5h7.5M16 19H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1.5" />
                    </svg>
                  )}
                  <span>{isVideoOn ? "Stop Video" : "Start Video"}</span>
                </button>
              </div>
            </div>

            {/* Right: Meeting Info & Join Box */}
            <div className="zm-prejoin-form-card">
              <h1 className="zm-prejoin-title">Ready to Join</h1>

              {joinError && (
                <div className="zm-prejoin-error-box">
                  <span>{joinError}</span>
                </div>
              )}

              <form onSubmit={handleJoin}>
                {/* Meeting Topic Info Header */}
                <div style={{ marginBottom: 16, padding: "10px 14px", backgroundColor: "#121417", borderRadius: 8, border: "1px solid #2a2d34" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", marginBottom: 2 }}>
                    {meeting?.title}
                  </div>
                  <div style={{ fontSize: 12, color: "#8c93a0" }}>
                    Meeting ID: <code style={{ color: "#2d8cff", fontWeight: 700 }}>{meeting?.meeting_id}</code>
                  </div>
                </div>

                {/* Your Name */}
                <div className="zm-prejoin-group">
                  <label className="zm-prejoin-label" htmlFor="input-your-name">
                    Your Name
                  </label>
                  <input
                    id="input-your-name"
                    type="text"
                    className="zm-prejoin-input"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>

                {/* Join Button */}
                <button
                  id="btn-join-room"
                  type="submit"
                  className="zm-prejoin-btn-join"
                  disabled={isJoining || !displayName.trim()}
                >
                  {isJoining ? "Joining..." : "Join"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="zm-prejoin-footer">
          © 2026 Zoom Communications, Inc. All rights reserved.
        </footer>
      </div>
    </div>
  );
}

export default function PrejoinPage({ params }: PrejoinPageProps) {
  const resolvedParams = use(params);
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#121417" }} />}>
      <PrejoinContent meetingId={resolvedParams.meetingId} />
    </Suspense>
  );
}
