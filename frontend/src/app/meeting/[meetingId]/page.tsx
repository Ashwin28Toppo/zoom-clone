"use client";

import React, { use, useState, useEffect, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getMeetingById,
  getParticipants,
  joinMeeting,
  leaveMeeting,
  updateParticipantMedia,
  muteAllParticipants,
  removeParticipant,
  endMeeting,
  Meeting,
  Participant,
} from "@/lib/api";
import "@/styles/meeting.css";

interface MeetingRoomProps {
  params: Promise<{ meetingId: string }>;
}

export default function MeetingRoomPage({ params }: MeetingRoomProps) {
  const resolvedParams = use(params);
  const meetingId = resolvedParams.meetingId;
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Meeting & Participant State
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMeetingEnded, setIsMeetingEnded] = useState(false);
  const [isParticipantRemoved, setIsParticipantRemoved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Local Media State
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [mediaPermissionDenied, setMediaPermissionDenied] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // UI Control State
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isShieldOpen, setIsShieldOpen] = useState(false);
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeReaction, setActiveReaction] = useState<string | null>(null);
  const [isReactionsOpen, setIsReactionsOpen] = useState(false);

  // Timer State (elapsed meeting seconds)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Ref Locks for concurrency & polling deduplication
  const isPollingRef = useRef(false);
  const isLeavingRef = useRef(false);
  const isEndingRef = useRef(false);
  const isActionPendingRef = useRef(false);

  // Stop all local media tracks helper
  const stopLocalMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      localStreamRef.current = null;
    }
  }, []);

  // 1. Initialize meeting & participant data (with auto-join fallback on direct URL navigation)
  useEffect(() => {
    let isMounted = true;

    async function initRoom() {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const meetingData = await getMeetingById(meetingId);

        if (!isMounted) return;

        if (meetingData.status === "ended") {
          setIsMeetingEnded(true);
          setIsLoading(false);
          return;
        }

        setMeeting(meetingData);

        // Fetch active participants list
        const participantsData = await getParticipants(meetingId);
        if (!isMounted) return;
        setParticipants(participantsData);

        // Restore participant from sessionStorage if available
        let activeParticipant: Participant | null = null;
        if (typeof window !== "undefined") {
          const stored = sessionStorage.getItem(`zoom_participant_${meetingId}`);
          if (stored) {
            try {
              activeParticipant = JSON.parse(stored) as Participant;
            } catch {
              activeParticipant = null;
            }
          }
        }

        // If no stored participant (e.g. direct URL visit or refresh), auto-join as Ashwin Toppo
        if (!activeParticipant) {
          try {
            activeParticipant = await joinMeeting(meetingId, {
              display_name: "Ashwin Toppo",
              is_audio_on: true,
              is_video_on: true,
            });
            if (typeof window !== "undefined") {
              sessionStorage.setItem(`zoom_participant_${meetingId}`, JSON.stringify(activeParticipant));
            }
          } catch {
            // If join fails, continue with fallback
          }
        }

        if (activeParticipant && isMounted) {
          setCurrentParticipant(activeParticipant);
          setIsAudioOn(activeParticipant.is_audio_on);
          setIsVideoOn(activeParticipant.is_video_on);
        }

        setIsLoading(false);
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Failed to load meeting";
          setErrorMessage(msg);
          setIsLoading(false);
        }
      }
    }

    initRoom();

    return () => {
      isMounted = false;
    };
  }, [meetingId]);

  // 2. Safe, deduplicated Polling for Participants & Meeting Status (every 3s)
  useEffect(() => {
    if (isMeetingEnded || isParticipantRemoved || errorMessage) return;

    const interval = setInterval(async () => {
      if (document.hidden || isPollingRef.current) return;

      try {
        isPollingRef.current = true;
        const [updatedMeeting, updatedParticipants] = await Promise.all([
          getMeetingById(meetingId),
          getParticipants(meetingId),
        ]);

        if (updatedMeeting.status === "ended") {
          setIsMeetingEnded(true);
          stopLocalMedia();
          return;
        }

        setMeeting(updatedMeeting);
        setParticipants(updatedParticipants);

        // Check if current participant was removed by host
        if (currentParticipant?.id) {
          const stillActive = updatedParticipants.find((p) => p.id === currentParticipant.id);
          if (!stillActive) {
            setIsParticipantRemoved(true);
            stopLocalMedia();
            if (typeof window !== "undefined") {
              sessionStorage.removeItem(`zoom_participant_${meetingId}`);
            }
            return;
          }

          // Check if remote mute was applied to this participant (e.g. host Mute All)
          if (!stillActive.is_audio_on && isAudioOn) {
            setIsAudioOn(false);
            if (localStreamRef.current) {
              localStreamRef.current.getAudioTracks().forEach((t) => {
                t.enabled = false;
              });
            }
          }
        }
      } catch {
        // Retain current state gracefully on transient network jitter
      } finally {
        isPollingRef.current = false;
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [meetingId, isMeetingEnded, isParticipantRemoved, errorMessage, currentParticipant, isAudioOn, stopLocalMedia]);

  // 3. Meeting Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 4. Manage local camera & microphone media stream
  useEffect(() => {
    let active = true;

    async function startMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Apply audio & video enabled states to hardware tracks
        stream.getAudioTracks().forEach((t) => {
          t.enabled = isAudioOn;
        });
        stream.getVideoTracks().forEach((t) => {
          t.enabled = isVideoOn;
        });

        setMediaPermissionDenied(false);
      } catch {
        if (active) {
          setMediaPermissionDenied(true);
          setIsVideoOn(false);
        }
      }
    }

    startMedia();

    // Register beforeunload cleanup so camera/mic lights turn off immediately
    const handleUnload = () => {
      stopLocalMedia();
    };

    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);

    return () => {
      active = false;
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
      stopLocalMedia();
    };
  }, [isAudioOn, isVideoOn, stopLocalMedia]);

  // 5. Toggle Audio (Mute / Unmute)
  async function handleToggleAudio() {
    const nextState = !isAudioOn;
    setIsAudioOn(nextState);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = nextState;
      });
    }

    if (currentParticipant?.id) {
      try {
        await updateParticipantMedia(meetingId, currentParticipant.id, {
          is_audio_on: nextState,
        });
      } catch {
        // Continue gracefully
      }
    }
  }

  // 6. Toggle Video (Start / Stop Video)
  async function handleToggleVideo() {
    const nextState = !isVideoOn;
    setIsVideoOn(nextState);

    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = nextState;
      });
    }

    if (currentParticipant?.id) {
      try {
        await updateParticipantMedia(meetingId, currentParticipant.id, {
          is_video_on: nextState,
        });
      } catch {
        // Continue gracefully
      }
    }
  }

  // 7. Leave Meeting (Deduplicated)
  async function handleLeaveMeeting() {
    if (isLeavingRef.current) return;
    try {
      isLeavingRef.current = true;
      if (currentParticipant?.id) {
        await leaveMeeting(meetingId, currentParticipant.id);
      }
    } catch {
      // Continue navigation even if leave API fails
    } finally {
      stopLocalMedia();
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(`zoom_participant_${meetingId}`);
      }
      startTransition(() => {
        router.push("/dashboard");
      });
    }
  }

  // 8. End Meeting for All (Host action - Deduplicated)
  async function handleEndMeeting() {
    if (isEndingRef.current) return;
    try {
      isEndingRef.current = true;
      await endMeeting(meetingId);
      setIsMeetingEnded(true);
    } catch {
      // Handle error
    } finally {
      stopLocalMedia();
      setIsEndModalOpen(false);
      startTransition(() => {
        router.push("/dashboard");
      });
    }
  }

  // 9. Host Mute All
  async function handleMuteAll() {
    if (isActionPendingRef.current) return;
    try {
      isActionPendingRef.current = true;
      const updated = await muteAllParticipants(meetingId);
      setParticipants(updated);
      setIsAudioOn(false);
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = false;
        });
      }
    } catch {
      alert("Failed to mute participants.");
    } finally {
      isActionPendingRef.current = false;
    }
  }

  // 10. Host Remove Participant
  async function handleRemoveParticipant(participantId: number) {
    if (isActionPendingRef.current) return;
    if (!confirm("Are you sure you want to remove this participant?")) return;
    try {
      isActionPendingRef.current = true;
      await removeParticipant(meetingId, participantId);
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    } catch {
      alert("Failed to remove participant.");
    } finally {
      isActionPendingRef.current = false;
    }
  }

  // 11. Copy Meeting Invite Link
  function copyInviteLink() {
    const inviteUrl = meeting?.invite_link || (typeof window !== "undefined" ? window.location.href : "");
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  // 12. Trigger Emoji Reaction
  function triggerReaction(emoji: string) {
    setActiveReaction(emoji);
    setIsReactionsOpen(false);
    setTimeout(() => setActiveReaction(null), 2500);
  }

  // Helpers
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isHost =
    currentParticipant?.role === "host" ||
    meeting?.host_name === currentParticipant?.display_name ||
    meeting?.host_name === "Ashwin Toppo";

  const filteredParticipants = participants.filter((p) =>
    p.display_name.toLowerCase().includes(participantSearch.toLowerCase())
  );

  const remoteParticipants = participants.filter(
    (p) => !currentParticipant || p.id !== currentParticipant.id
  );

  const totalTiles = 1 + remoteParticipants.length;
  const gridClass =
    totalTiles === 1
      ? "zm-grid-1"
      : totalTiles === 2
      ? "zm-grid-2"
      : totalTiles <= 4
      ? "zm-grid-4"
      : totalTiles <= 6
      ? "zm-grid-6"
      : "zm-grid-multi";

  if (isLoading) {
    return (
      <div className="zm-room-page" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div className="zm-spinner" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#0e71eb", margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Joining Meeting...</h2>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>Connecting to audio and video streams</p>
        </div>
      </div>
    );
  }

  if (isMeetingEnded) {
    return (
      <div className="zm-room-page" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="zm-modal-card" style={{ maxWidth: 460 }}>
          <div style={{ fontSize: 40 }}>🛑</div>
          <h2 className="zm-modal-title">This meeting has ended</h2>
          <p className="zm-modal-desc">
            The host has ended this meeting or the session has expired.
          </p>
          <div className="zm-modal-actions">
            <Link href="/dashboard" className="zm-modal-btn danger" style={{ textDecoration: "none" }}>
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isParticipantRemoved) {
    return (
      <div className="zm-room-page" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="zm-modal-card" style={{ maxWidth: 460 }}>
          <div style={{ fontSize: 40 }}>🚫</div>
          <h2 className="zm-modal-title">Removed from Meeting</h2>
          <p className="zm-modal-desc">
            You were removed from this meeting by the host.
          </p>
          <div className="zm-modal-actions">
            <Link href="/dashboard" className="zm-modal-btn secondary" style={{ textDecoration: "none" }}>
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="zm-room-page" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="zm-modal-card" style={{ maxWidth: 460 }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h2 className="zm-modal-title">Unable to Join</h2>
          <p className="zm-modal-desc">{errorMessage}</p>
          <div className="zm-modal-actions">
            <Link href="/dashboard" className="zm-modal-btn secondary" style={{ textDecoration: "none" }}>
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="zm-room-page">
      {/* ---------------- Top Header ---------------- */}
      <header className="zm-room-header">
        <div className="zm-room-header-left">
          {/* Green Shield button for Meeting Info */}
          <button
            type="button"
            className="zm-shield-btn"
            title="Meeting Information"
            onClick={() => setIsShieldOpen((prev) => !prev)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
            </svg>
          </button>

          <span className="zm-room-topic">{meeting?.title || "Zoom Meeting"}</span>
          <span className="zm-room-timer">{formatTime(elapsedSeconds)}</span>

          {/* Shield Popup Dropdown */}
          {isShieldOpen && (
            <div className="zm-shield-dropdown">
              <div className="zm-shield-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                </svg>
                <span>Meeting Information</span>
              </div>
              <div className="zm-shield-row">
                <span className="zm-shield-row-label">Topic</span>
                <span className="zm-shield-row-value">{meeting?.title}</span>
              </div>
              <div className="zm-shield-row">
                <span className="zm-shield-row-label">Meeting ID</span>
                <span className="zm-shield-row-value" style={{ fontFamily: "monospace", letterSpacing: 1, color: "#2d8cff" }}>
                  {meeting?.meeting_id}
                </span>
              </div>
              <div className="zm-shield-row">
                <span className="zm-shield-row-label">Host</span>
                <span className="zm-shield-row-value">{meeting?.host_name}</span>
              </div>
              <div className="zm-shield-row">
                <span className="zm-shield-row-label">Passcode</span>
                <span className="zm-shield-row-value">123456</span>
              </div>
              <button
                type="button"
                className="zm-copy-link-btn"
                onClick={copyInviteLink}
              >
                {copiedLink ? "✓ Invite Link Copied!" : "Copy Invite Link"}
              </button>
            </div>
          )}
        </div>

        <div className="zm-room-header-right">
          <button type="button" className="zm-view-toggle-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            <span>View</span>
          </button>
        </div>
      </header>

      {/* ---------------- Main Content Workspace ---------------- */}
      <main className="zm-room-main" onClick={() => { if (isShieldOpen) setIsShieldOpen(false); }}>
        {/* Floating Animated Reaction */}
        {activeReaction && (
          <div
            style={{
              position: "absolute",
              bottom: 100,
              left: 30,
              fontSize: 48,
              zIndex: 999,
              animation: "bounce 0.5s infinite alternate",
            }}
          >
            {activeReaction}
          </div>
        )}

        {/* Video Canvas Area */}
        <div className="zm-video-canvas">
          <div className={`zm-grid ${gridClass}`}>
            {/* Tile 1: Local User Video / Avatar */}
            <div className={`zm-video-tile ${isAudioOn ? "speaking" : ""}`}>
              {isVideoOn && !mediaPermissionDenied ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="zm-video-element"
                />
              ) : (
                <div className="zm-tile-avatar-view">
                  <div className="zm-tile-avatar">
                    {currentParticipant?.display_name
                      ? currentParticipant.display_name.charAt(0).toUpperCase()
                      : "A"}
                  </div>
                </div>
              )}

              {/* Local User Nametag */}
              <div className="zm-tile-nametag">
                <span className="zm-tile-nametag-icon">
                  {isAudioOn ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#30d158">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="#30d158" strokeWidth="2" fill="none" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                    </svg>
                  )}
                </span>
                <span>{currentParticipant?.display_name || "Ashwin Toppo"} (Me)</span>
                {isHost && <span className="zm-tile-badge-host">Host</span>}
              </div>
            </div>

            {/* Remote Participant Tiles */}
            {remoteParticipants.map((p, idx) => (
              <div key={p.id} className="zm-video-tile">
                <div className="zm-tile-avatar-view">
                  <div className={`zm-tile-avatar alt-${(idx % 4) + 1}`}>
                    {p.display_name.charAt(0).toUpperCase()}
                  </div>
                </div>

                {/* Nametag */}
                <div className="zm-tile-nametag">
                  <span className="zm-tile-nametag-icon">
                    {p.is_audio_on ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#30d158">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="#30d158" strokeWidth="2" fill="none" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2">
                        <line x1="1" y1="1" x2="23" y2="23" />
                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                      </svg>
                    )}
                  </span>
                  <span>{p.display_name}</span>
                  {p.role === "host" && <span className="zm-tile-badge-host">Host</span>}
                </div>

                {/* Host Control Actions on Hover */}
                {isHost && (
                  <div className="zm-tile-hover-actions">
                    <button
                      type="button"
                      className="zm-tile-action-btn danger"
                      onClick={() => handleRemoveParticipant(p.id)}
                      title="Remove participant"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ---------------- Slide-in Participants Drawer ---------------- */}
        {isParticipantsOpen && (
          <aside className="zm-side-drawer">
            <div className="zm-drawer-header">
              <span className="zm-drawer-title">Participants ({participants.length || 1})</span>
              <button
                type="button"
                className="zm-drawer-close-btn"
                onClick={() => setIsParticipantsOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="zm-drawer-search">
              <input
                type="text"
                className="zm-drawer-search-input"
                placeholder="Find a participant..."
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
              />
            </div>

            <div className="zm-participant-list">
              {/* Local User Row */}
              <div className="zm-participant-item">
                <div className="zm-participant-info">
                  <div className="zm-participant-avatar">
                    {currentParticipant?.display_name?.charAt(0).toUpperCase() || "A"}
                  </div>
                  <div>
                    <div className="zm-participant-name">
                      {currentParticipant?.display_name || "Ashwin Toppo"}
                      <span className="zm-participant-tags"> ({isHost ? "Host, me" : "me"})</span>
                    </div>
                  </div>
                </div>
                <div className="zm-participant-actions">
                  {isAudioOn ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#30d158">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                    </svg>
                  )}
                  {isVideoOn ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#cbd5e1">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <polygon points="23 7 16 12 23 17 23 7" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Other Participants */}
              {filteredParticipants
                .filter((p) => !currentParticipant || p.id !== currentParticipant.id)
                .map((p) => (
                  <div key={p.id} className="zm-participant-item">
                    <div className="zm-participant-info">
                      <div className="zm-participant-avatar" style={{ backgroundColor: "#8a2be2" }}>
                        {p.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="zm-participant-name">
                          {p.display_name}
                          {p.role === "host" && <span className="zm-participant-tags"> (Host)</span>}
                        </div>
                      </div>
                    </div>
                    <div className="zm-participant-actions">
                      {p.is_audio_on ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#30d158">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2">
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                        </svg>
                      )}

                      {isHost && (
                        <button
                          type="button"
                          className="zm-tile-action-btn danger"
                          style={{ padding: "2px 6px", fontSize: 10 }}
                          onClick={() => handleRemoveParticipant(p.id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {/* Drawer Host Controls Footer */}
            <div className="zm-drawer-footer">
              <button
                type="button"
                className="zm-drawer-btn"
                onClick={copyInviteLink}
              >
                {copiedLink ? "✓ Copied" : "Invite"}
              </button>
              {isHost && (
                <button
                  type="button"
                  className="zm-drawer-btn"
                  onClick={handleMuteAll}
                >
                  Mute All
                </button>
              )}
            </div>
          </aside>
        )}
      </main>

      {/* ---------------- Bottom Dock Toolbar ---------------- */}
      <footer className="zm-room-dock">
        {/* Left: Audio & Video controls */}
        <div className="zm-dock-left">
          {/* Mute / Unmute Button */}
          <button
            type="button"
            className={`zm-dock-btn ${!isAudioOn ? "muted" : ""}`}
            onClick={handleToggleAudio}
            id="btn-toggle-mic"
          >
            {isAudioOn ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
            <span>{isAudioOn ? "Mute" : "Unmute"}</span>
          </button>

          {/* Start / Stop Video Button */}
          <button
            type="button"
            className={`zm-dock-btn ${!isVideoOn ? "muted" : ""}`}
            onClick={handleToggleVideo}
            id="btn-toggle-video"
          >
            {isVideoOn ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M21 15.5l-5-3.5v-5l5-3.5v12zM2 5h7.5M16 19H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1.5" />
              </svg>
            )}
            <span>{isVideoOn ? "Stop Video" : "Start Video"}</span>
          </button>
        </div>

        {/* Center: Meeting Actions */}
        <div className="zm-dock-center">
          {/* Security */}
          <button
            type="button"
            className="zm-dock-btn"
            onClick={() => setIsShieldOpen((prev) => !prev)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Security</span>
          </button>

          {/* Participants */}
          <button
            type="button"
            className={`zm-dock-btn ${isParticipantsOpen ? "active" : ""}`}
            onClick={() => setIsParticipantsOpen((prev) => !prev)}
            id="btn-toggle-participants"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="zm-dock-btn-badge">{participants.length || 1}</span>
            <span>Participants</span>
          </button>

          {/* Chat */}
          <button
            type="button"
            className="zm-dock-btn"
            onClick={() => alert("In-meeting chat is available.")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Chat</span>
          </button>

          {/* Share Screen */}
          <button
            type="button"
            className="zm-dock-btn share-btn"
            onClick={async () => {
              try {
                await navigator.mediaDevices.getDisplayMedia({ video: true });
              } catch {
                // Ignore if user cancelled dialog
              }
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
              <polyline points="16 9 12 5 8 9" />
            </svg>
            <span>Share Screen</span>
          </button>

          {/* Record */}
          <button
            type="button"
            className="zm-dock-btn"
            onClick={() => alert("Cloud recording has started.")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
            <span>Record</span>
          </button>

          {/* Reactions */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className="zm-dock-btn"
              onClick={() => setIsReactionsOpen((prev) => !prev)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
              <span>Reactions</span>
            </button>

            {isReactionsOpen && (
              <div
                style={{
                  position: "absolute",
                  bottom: 60,
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "#1e222b",
                  border: "1px solid #333946",
                  borderRadius: 24,
                  padding: "6px 12px",
                  display: "flex",
                  gap: 10,
                  fontSize: 22,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  zIndex: 100,
                }}
              >
                {["👍", "👏", "❤️", "😂", "🎉", "✋"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 22 }}
                    onClick={() => triggerReaction(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: End / Leave button */}
        <div className="zm-dock-right">
          <button
            type="button"
            className="zm-end-btn"
            onClick={() => setIsEndModalOpen(true)}
            id="btn-leave-meeting"
          >
            {isHost ? "End" : "Leave"}
          </button>
        </div>
      </footer>

      {/* ---------------- End / Leave Confirmation Modal ---------------- */}
      {isEndModalOpen && (
        <div className="zm-modal-backdrop" onClick={() => setIsEndModalOpen(false)}>
          <div className="zm-modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="zm-modal-title">
              {isHost ? "End Meeting or Leave?" : "Leave Meeting?"}
            </h2>
            <p className="zm-modal-desc">
              {isHost
                ? "You can end the meeting for all participants, or leave the meeting and assign a new host."
                : "Are you sure you want to leave this meeting?"}
            </p>
            <div className="zm-modal-actions">
              {isHost && (
                <button
                  type="button"
                  className="zm-modal-btn danger"
                  onClick={handleEndMeeting}
                >
                  End Meeting for All
                </button>
              )}
              <button
                type="button"
                className="zm-modal-btn secondary"
                onClick={handleLeaveMeeting}
              >
                Leave Meeting
              </button>
              <button
                type="button"
                className="zm-modal-btn cancel"
                onClick={() => setIsEndModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
