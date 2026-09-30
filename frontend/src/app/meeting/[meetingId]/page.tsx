"use client";

import React, { use, useState, useEffect, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
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
import { useWebRTC } from "@/lib/webrtc";
import "@/styles/dashboard.css";
import "@/styles/meeting.css";

interface RemoteParticipantTileProps {
  participant: Participant;
  stream?: MediaStream;
  index: number;
  isHost: boolean;
  onRemove: (id: number) => void;
}

function RemoteParticipantTile({
  participant,
  stream,
  index,
  isHost,
  onRemove,
}: RemoteParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, participant.is_video_on]);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(() => {});
    }
  }, [stream]);

  const hasLiveVideo = Boolean(
    stream &&
      stream.getVideoTracks().length > 0 &&
      participant.is_video_on
  );

  return (
    <div className="zm-video-tile">
      {/* Remote Audio output to hear their voice */}
      {stream && <audio ref={audioRef} autoPlay playsInline />}

      {hasLiveVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="zm-video-element"
        />
      ) : (
        <div className="zm-tile-avatar-view">
          <div className={`zm-tile-avatar alt-${(index % 4) + 1}`}>
            {participant.display_name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      <div className="zm-tile-nametag">
        {!participant.is_audio_on ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2.5">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#30d158">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          </svg>
        )}
        <span>{participant.display_name}</span>
      </div>

      {isHost && (
        <div className="zm-tile-hover-actions">
          <button
            type="button"
            className="zm-tile-action-btn danger"
            onClick={() => onRemove(participant.id)}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

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
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
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

  // Concurrency & Polling locks
  const isPollingRef = useRef(false);
  const isLeavingRef = useRef(false);
  const isEndingRef = useRef(false);
  const isActionPendingRef = useRef(false);

  // Stop media helper
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
      setLocalStream(null);
    }
  }, []);

  // 1. Initialize meeting & participant data
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

        // Fetch active participants
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

        // Direct URL visit fallback: auto-join
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
            // fallback
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

  // 2. Safe polling loop (every 3s)
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

        // Check if kicked
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

          // Check remote mute
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
        // network jitter
      } finally {
        isPollingRef.current = false;
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [meetingId, isMeetingEnded, isParticipantRemoved, errorMessage, currentParticipant, isAudioOn, stopLocalMedia]);

  // 3. Local Camera/Mic Stream
  useEffect(() => {
    let active = true;

    async function startMedia() {
      try {
        if (!localStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });

          if (!active) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          localStreamRef.current = stream;
          setLocalStream(stream);
        }

        if (videoRef.current && localStreamRef.current) {
          videoRef.current.srcObject = localStreamRef.current;
        }

        localStreamRef.current.getAudioTracks().forEach((t) => {
          t.enabled = isAudioOn;
        });
        localStreamRef.current.getVideoTracks().forEach((t) => {
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

    const handleUnload = () => {
      stopLocalMedia();
    };

    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);

    return () => {
      active = false;
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopLocalMedia]);

  // Bind video element when video is toggled back on
  useEffect(() => {
    if (isVideoOn && videoRef.current && localStreamRef.current) {
      videoRef.current.srcObject = localStreamRef.current;
    }
  }, [isVideoOn]);

  // 4. Toggle Audio
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
        // ignore
      }
    }
  }

  // 5. Toggle Video
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
        // ignore
      }
    }
  }

  // 6. Leave Meeting
  async function handleLeaveMeeting() {
    if (isLeavingRef.current) return;
    try {
      isLeavingRef.current = true;
      if (currentParticipant?.id) {
        await leaveMeeting(meetingId, currentParticipant.id);
      }
    } catch {
      // ignore
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

  // 7. End Meeting for All
  async function handleEndMeeting() {
    if (isEndingRef.current) return;
    try {
      isEndingRef.current = true;
      await endMeeting(meetingId);
      setIsMeetingEnded(true);
    } catch {
      // ignore
    } finally {
      stopLocalMedia();
      setIsEndModalOpen(false);
      startTransition(() => {
        router.push("/dashboard");
      });
    }
  }

  // 8. Host Mute All
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

  // 9. Host Remove Participant
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

  // 10. Copy Invite Link
  function copyInviteLink() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${origin}/meeting/${meetingId}/prejoin`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  // 11. Trigger Reaction
  function triggerReaction(emoji: string) {
    setActiveReaction(emoji);
    setIsReactionsOpen(false);
    setTimeout(() => setActiveReaction(null), 2500);
  }

  const isHost =
    currentParticipant?.role === "host" ||
    (Boolean(meeting?.host_name) &&
      Boolean(currentParticipant?.display_name) &&
      currentParticipant?.display_name?.trim().toLowerCase() === meeting?.host_name?.trim().toLowerCase());

  const filteredParticipants = participants.filter((p) =>
    p.display_name.toLowerCase().includes(participantSearch.toLowerCase())
  );

  const remoteParticipants = participants.filter(
    (p) => !currentParticipant || p.id !== currentParticipant.id
  );

  const { remoteStreams } = useWebRTC(
    meetingId,
    currentParticipant?.id,
    localStream,
    remoteParticipants
  );

  const totalTiles = 1 + remoteParticipants.length;
  const gridClass =
    totalTiles === 1
      ? "zm-grid-1"
      : totalTiles === 2
      ? "zm-grid-2"
      : totalTiles <= 4
      ? "zm-grid-4"
      : "zm-grid-multi";

  if (isLoading) {
    return (
      <div className="zm-room-layout" style={{ backgroundColor: "#000000", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: "#ffffff" }}>
          <div className="zm-spinner" style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "#0e71eb", margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Connecting to meeting...</h2>
        </div>
      </div>
    );
  }

  if (isMeetingEnded) {
    return (
      <div className="zm-room-layout" style={{ backgroundColor: "#000000", alignItems: "center", justifyContent: "center" }}>
        <div className="zm-modal-card" style={{ maxWidth: 460 }}>
          <div style={{ fontSize: 40 }}>🛑</div>
          <h2 className="zm-modal-title">This meeting has ended</h2>
          <p className="zm-modal-desc">The host has ended this meeting or the session has expired.</p>
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
      <div className="zm-room-layout" style={{ backgroundColor: "#000000", alignItems: "center", justifyContent: "center" }}>
        <div className="zm-modal-card" style={{ maxWidth: 460 }}>
          <div style={{ fontSize: 40 }}>🚫</div>
          <h2 className="zm-modal-title">Removed from Meeting</h2>
          <p className="zm-modal-desc">You were removed from this meeting by the host.</p>
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
    <div className="zm-room-layout">
      {/* ---------------- Top Navbar (matching Image 1) ---------------- */}
      <Navbar variant="workplace" />

      <div className="zm-room-main-container">
        {/* ---------------- Left Sidebar (matching Image 1) ---------------- */}
        <aside className="zm-room-sidebar">
          <div className="zm-room-side-top">
            <Link href="/dashboard" className="zm-room-side-item" title="Home">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              <span>Home</span>
            </Link>

            <div className="zm-room-side-item" title="Chat">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>Chat</span>
            </div>

            <div className="zm-room-side-item active" title="Meetings">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
              <span>Meetings</span>
            </div>

            <div className="zm-room-side-item" title="Contacts">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <span>Contacts</span>
            </div>
          </div>

          <div className="zm-room-side-item" title="Settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Settings</span>
          </div>
        </aside>

        {/* ---------------- Central Meeting Viewport (matching Image 1) ---------------- */}
        <section className="zm-room-viewport">
          {/* Top internal meeting bar matching Image 1 */}
          <div className="zm-viewport-header">
            <div className="zm-viewport-header-left" onClick={() => setIsShieldOpen((prev) => !prev)}>
              <button type="button" className="zm-info-icon-btn" title="Meeting Information">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </button>
              <span>{meeting?.title || "Ashwin Toppo's Zoom Meeting"}</span>
            </div>

            {/* Right icons matching Image 1: Green Shield, Pencil, Sparkle, Grid view, Avatar circle */}
            <div className="zm-viewport-header-right">
              <button
                type="button"
                className="zm-hdr-icon-btn zm-hdr-shield"
                title="Security"
                onClick={() => setIsShieldOpen((prev) => !prev)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                </svg>
              </button>

              <button type="button" className="zm-hdr-icon-btn" title="Whiteboard">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19l7-7 3 3-7 7-3-3z" />
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                </svg>
              </button>

              <button type="button" className="zm-hdr-icon-btn" title="AI Companion">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
                </svg>
              </button>

              <button type="button" className="zm-hdr-icon-btn" title="View">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>

              <div className="zm-hdr-avatar-badge" title="Ashwin Toppo">
                zm
              </div>
            </div>

            {/* Info Dropdown */}
            {isShieldOpen && (
              <div className="zm-shield-dropdown">
                <div className="zm-shield-header">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
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
                  <span className="zm-shield-row-value" style={{ fontFamily: "monospace", color: "#2d8cff" }}>
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
                <button type="button" className="zm-copy-link-btn" onClick={copyInviteLink}>
                  {copiedLink ? "✓ Invite Link Copied!" : "Copy Invite Link"}
                </button>
              </div>
            )}
          </div>

          {/* Video Canvas */}
          <div className="zm-room-video-canvas" onClick={() => { if (isShieldOpen) setIsShieldOpen(false); }}>
            {activeReaction && (
              <div style={{ position: "absolute", bottom: 80, left: 24, fontSize: 44, zIndex: 99 }}>
                {activeReaction}
              </div>
            )}

            <div className={`zm-grid ${gridClass}`}>
              {/* Local User Tile */}
              <div className="zm-video-tile">
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

                {/* Nametag matching Image 1: mic state + name */}
                <div className="zm-tile-nametag">
                  {!isAudioOn ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2.5">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="#30d158">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    </svg>
                  )}
                  <span>{currentParticipant?.display_name || "Ashwin Toppo"}</span>
                </div>
              </div>

              {/* Remote Participants */}
              {remoteParticipants.map((p, idx) => (
                <RemoteParticipantTile
                  key={p.id}
                  participant={p}
                  stream={remoteStreams.get(p.id)}
                  index={idx}
                  isHost={isHost}
                  onRemove={handleRemoveParticipant}
                />
              ))}
            </div>
          </div>

          {/* ---------------- Slide-in Participants Drawer ---------------- */}
          {isParticipantsOpen && (
            <aside className="zm-side-drawer" style={{ position: "absolute", right: 0, top: 0, bottom: 64 }}>
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
                <div className="zm-participant-item">
                  <div className="zm-participant-info">
                    <div className="zm-participant-avatar">
                      {currentParticipant?.display_name?.charAt(0).toUpperCase() || "A"}
                    </div>
                    <div className="zm-participant-name">
                      {currentParticipant?.display_name || "Guest"}
                      <span className="zm-participant-tags"> {isHost ? "(Host, me)" : "(Me)"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {isAudioOn ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="#30d158"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /></svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12" /></svg>
                    )}
                  </div>
                </div>

                {filteredParticipants
                  .filter((p) => !currentParticipant || p.id !== currentParticipant.id)
                  .map((p) => (
                    <div key={p.id} className="zm-participant-item">
                      <div className="zm-participant-info">
                        <div className="zm-participant-avatar" style={{ backgroundColor: "#8a2be2" }}>
                          {p.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="zm-participant-name">{p.display_name}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {p.is_audio_on ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="#30d158"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /></svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12" /></svg>
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

              <div className="zm-drawer-footer">
                <button type="button" className="zm-drawer-btn" onClick={copyInviteLink}>
                  {copiedLink ? "✓ Copied" : "Invite"}
                </button>
                {isHost && (
                  <button type="button" className="zm-drawer-btn primary" onClick={handleMuteAll}>
                    Mute All
                  </button>
                )}
              </div>
            </aside>
          )}

          {/* ---------------- Bottom Control Toolbar Dock (matching Image 1) ---------------- */}
          <footer className="zm-bottom-dock">
            {/* Left: Audio & Video */}
            <div className="zm-dock-left">
              {/* Audio */}
              <button
                type="button"
                className="zm-dock-item"
                onClick={handleToggleAudio}
                title={isAudioOn ? "Mute Microphone" : "Unmute Microphone"}
              >
                <div className="zm-dock-item-icon">
                  {!isAudioOn ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                      <path d="M17 16.95A7 7 0 0 1 5 12v-2" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" y1="19" x2="12" y2="23" />
                      <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                  )}
                  <span className="zm-dock-caret">⌃</span>
                </div>
                <span>Audio</span>
              </button>

              {/* Video (with rounded border box matching Image 1) */}
              <button
                type="button"
                className="zm-dock-item video-box"
                onClick={handleToggleVideo}
                title={isVideoOn ? "Stop Video" : "Start Video"}
              >
                <div className="zm-dock-item-icon">
                  {!isVideoOn ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M21 15.5l-5-3.5v-5l5-3.5v12zM2 5h7.5M16 19H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1.5" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                    </svg>
                  )}
                  <span className="zm-dock-caret">⌃</span>
                </div>
                <span>Video</span>
              </button>
            </div>

            {/* Center: Participants, Chat, React, Share, Host tools, More */}
            <div className="zm-dock-center">
              {/* Participants */}
              <button
                type="button"
                className="zm-dock-item"
                onClick={() => setIsParticipantsOpen((prev) => !prev)}
              >
                <div className="zm-dock-item-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                  <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 2 }}>{participants.length || 1}</span>
                  <span className="zm-dock-caret">⌃</span>
                </div>
                <span>Participants</span>
              </button>

              {/* Chat */}
              <button
                type="button"
                className="zm-dock-item"
                onClick={() => alert("In-meeting chat is available.")}
              >
                <div className="zm-dock-item-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="zm-dock-caret">⌃</span>
                </div>
                <span>Chat</span>
              </button>

              {/* React */}
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  className="zm-dock-item"
                  onClick={() => setIsReactionsOpen((prev) => !prev)}
                >
                  <div className="zm-dock-item-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    <span className="zm-dock-caret">⌃</span>
                  </div>
                  <span>React</span>
                </button>

                {isReactionsOpen && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 56,
                      left: "50%",
                      transform: "translateX(-50%)",
                      backgroundColor: "#1e222b",
                      border: "1px solid #333946",
                      borderRadius: 24,
                      padding: "6px 12px",
                      display: "flex",
                      gap: 10,
                      fontSize: 22,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.7)",
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

              {/* Share */}
              <button
                type="button"
                className="zm-dock-item"
                onClick={async () => {
                  try {
                    await navigator.mediaDevices.getDisplayMedia({ video: true });
                  } catch {
                    // ignore
                  }
                }}
              >
                <div className="zm-dock-item-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                    <polyline points="16 9 12 5 8 9" />
                  </svg>
                  <span className="zm-dock-caret">⌃</span>
                </div>
                <span>Share</span>
              </button>

              {/* Host tools (Host only) */}
              {isHost && (
                <button
                  type="button"
                  className="zm-dock-item"
                  onClick={() => setIsShieldOpen((prev) => !prev)}
                >
                  <div className="zm-dock-item-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span className="zm-dock-caret">⌃</span>
                  </div>
                  <span>Host tools</span>
                </button>
              )}

              {/* More */}
              <button
                type="button"
                className="zm-dock-item"
                onClick={() => alert("More options: Cloud Recording, Virtual Backgrounds, Audio Settings.")}
              >
                <div className="zm-dock-item-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="19" cy="12" r="1" />
                    <circle cx="5" cy="12" r="1" />
                  </svg>
                </div>
                <span>More</span>
              </button>
            </div>

            {/* Right: End/Leave button matching Image 1 */}
            <div className="zm-dock-right">
              <button
                type="button"
                className="zm-end-circle-btn"
                onClick={() => setIsEndModalOpen(true)}
              >
                <div className="zm-end-circle-icon">✕</div>
                <span>{isHost ? "End" : "Leave"}</span>
              </button>
            </div>
          </footer>
        </section>
      </div>

      {/* ---------------- End / Leave Modal ---------------- */}
      {isEndModalOpen && (
        <div className="zm-modal-backdrop" onClick={() => setIsEndModalOpen(false)}>
          <div className="zm-modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="zm-modal-title">
              {isHost ? "End Meeting or Leave?" : "Leave Meeting"}
            </h2>
            <p className="zm-modal-desc">
              {isHost
                ? "You can end the meeting for all participants, or leave the meeting."
                : "Are you sure you want to leave this meeting?"}
            </p>
            <div className="zm-modal-actions">
              {isHost ? (
                <>
                  <button
                    type="button"
                    className="zm-modal-btn danger"
                    onClick={handleEndMeeting}
                  >
                    End Meeting for All
                  </button>
                  <button
                    type="button"
                    className="zm-modal-btn secondary"
                    onClick={handleLeaveMeeting}
                  >
                    Leave Meeting
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="zm-modal-btn danger"
                  onClick={handleLeaveMeeting}
                >
                  Leave Meeting
                </button>
              )}
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
