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
  sendHeartbeat,
  sendBeaconLeave,
  Meeting,
  Participant,
} from "@/lib/api";
import { useWebRTC } from "@/lib/webrtc";
import { useAuth } from "@/lib/auth-context";
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

  const attachVideo = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && stream) {
        if (el.srcObject !== stream) el.srcObject = stream;
        el.play().then(() => {}).catch(() => {});
      }
    },
    [stream]
  );

  const attachAudio = useCallback(
    (el: HTMLAudioElement | null) => {
      audioRef.current = el;
      if (el && stream) {
        if (el.srcObject !== stream) el.srcObject = stream;
        el.play().catch(() => {});
      }
    },
    [stream]
  );

  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) videoRef.current.srcObject = stream;
      videoRef.current.play().then(() => {}).catch(() => {});
    }
    if (audioRef.current && stream) {
      if (audioRef.current.srcObject !== stream) audioRef.current.srcObject = stream;
      audioRef.current.play().catch(() => {});
    }
  }, [stream, participant.is_video_on]);

  const hasLiveVideoTrack = Boolean(
    stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live")
  );

  return (
    <div className="zm-video-tile" style={{ position: "relative", overflow: "hidden" }}>
      <audio ref={attachAudio} autoPlay playsInline />
      <video
        ref={attachVideo}
        autoPlay
        playsInline
        className="zm-video-element"
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />

      {!hasLiveVideoTrack && (
        <div
          className="zm-tile-avatar-view"
          style={{ position: "absolute", inset: 0, zIndex: 2, backgroundColor: "#11161f", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div className={`zm-tile-avatar alt-${(index % 4) + 1}`}>
            {participant.display_name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      <div className="zm-tile-nametag" style={{ zIndex: 3 }}>
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
        <div className="zm-tile-hover-actions" style={{ zIndex: 4 }}>
          <button
            type="button"
            className="zm-tile-action-btn danger"
            onClick={() => onRemove(participant.id)}
            title="Remove participant"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Icon components (defined outside to avoid re-creation on every render) ────
function MicOnIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  );
}
function MicOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2" />
    </svg>
  );
}
function CamOnIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}
function CamOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M21 15.5l-5-3.5v-5l5-3.5v12zM2 5h7.5M16 19H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1.5" />
    </svg>
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

  // ─── Meeting & Participant State ────────────────────────────────────────────
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMeetingEnded, setIsMeetingEnded] = useState(false);
  const [isParticipantRemoved, setIsParticipantRemoved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── Local Media State ──────────────────────────────────────────────────────
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [mediaPermissionDenied, setMediaPermissionDenied] = useState(false);
  // localStream STATE drives the WebRTC hook — must call setLocalStream() to trigger replaceTrack
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // localStreamRef mirrors localStream state for use inside callbacks/effects without stale closures
  const localStreamRef = useRef<MediaStream | null>(null);

  // ─── Screen Share State ─────────────────────────────────────────────────────
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);

  const attachLocalVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && localStreamRef.current) {
      if (el.srcObject !== localStreamRef.current) el.srcObject = localStreamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  // ─── UI Control State ───────────────────────────────────────────────────────
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isShieldOpen, setIsShieldOpen] = useState(false);
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // ─── Concurrency & Polling locks ────────────────────────────────────────────
  const isPollingRef = useRef(false);
  const isLeavingRef = useRef(false);
  const isEndingRef = useRef(false);
  const isActionPendingRef = useRef(false);
  const { token, user } = useAuth();

  // ─── Stop all local media tracks ────────────────────────────────────────────
  const stopLocalMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => { try { t.stop(); } catch { /* ignore */ } });
      localStreamRef.current = null;
      setLocalStream(null);
    }
    if (screenTrackRef.current) {
      try { screenTrackRef.current.stop(); } catch { /* ignore */ }
      screenTrackRef.current = null;
    }
    originalVideoTrackRef.current = null;
  }, []);

  // ─── 1. Initialize meeting & participant data ────────────────────────────────
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

        const participantsData = await getParticipants(meetingId);
        if (!isMounted) return;
        setParticipants(participantsData);

        let activeParticipant: Participant | null = null;
        if (typeof window !== "undefined") {
          const stored = sessionStorage.getItem(`zoom_participant_${meetingId}`);
          if (stored) {
            try { activeParticipant = JSON.parse(stored) as Participant; } catch { activeParticipant = null; }
          }
        }

        if (!activeParticipant) {
          startTransition(() => router.replace(`/meeting/${meetingId}/prejoin`));
          return;
        }

        if (activeParticipant && isMounted) {
          setCurrentParticipant(activeParticipant);
          setIsAudioOn(activeParticipant.is_audio_on);
          setIsVideoOn(activeParticipant.is_video_on);
        }
        setIsLoading(false);
      } catch (err: unknown) {
        if (isMounted) {
          setErrorMessage(err instanceof Error ? err.message : "Failed to load meeting");
          setIsLoading(false);
        }
      }
    }
    initRoom();
    return () => { isMounted = false; };
  }, [meetingId]);

  // ─── 2. Polling loop (every 3s) ──────────────────────────────────────────────
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

        if (currentParticipant?.id) {
          const stillActive = updatedParticipants.find((p) => p.id === currentParticipant.id);
          if (!stillActive) {
            setIsParticipantRemoved(true);
            stopLocalMedia();
            if (typeof window !== "undefined") sessionStorage.removeItem(`zoom_participant_${meetingId}`);
            return;
          }
          // Detect remote mute
          if (!stillActive.is_audio_on && isAudioOn) {
            setIsAudioOn(false);
            localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = false; });
          }
        }
      } catch { /* network jitter */ } finally {
        isPollingRef.current = false;
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [meetingId, isMeetingEnded, isParticipantRemoved, errorMessage, currentParticipant, isAudioOn, stopLocalMedia]);

  // ─── 3. Heartbeat (every 8s) — keeps participant alive in backend ─────────────
  useEffect(() => {
    if (!currentParticipant?.id || isMeetingEnded || isParticipantRemoved) return;
    const pid = currentParticipant.id;

    // Send first heartbeat immediately
    sendHeartbeat(meetingId, pid);

    const interval = setInterval(() => {
      sendHeartbeat(meetingId, pid);
    }, 8000);

    return () => clearInterval(interval);
  }, [meetingId, currentParticipant?.id, isMeetingEnded, isParticipantRemoved]);

  // ─── 4. Reliable leave on tab close / navigation ─────────────────────────────
  useEffect(() => {
    if (!currentParticipant?.id) return;
    const pid = currentParticipant.id;

    const handlePageHide = () => {
      sendBeaconLeave(meetingId, pid);
    };

    // pagehide is more reliable than beforeunload (works on mobile, bfcache, etc.)
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
    };
  }, [meetingId, currentParticipant?.id]);

  // ─── 5. Local Camera/Mic Stream ───────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    async function startMedia() {
      try {
        if (!localStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
          localStreamRef.current = stream;
          setLocalStream(stream);
        }
        if (videoRef.current && localStreamRef.current) {
          videoRef.current.srcObject = localStreamRef.current;
        }
        localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = isAudioOn; });
        localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = isVideoOn; });
        setMediaPermissionDenied(false);
      } catch {
        if (active) { setMediaPermissionDenied(true); setIsVideoOn(false); }
      }
    }
    startMedia();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopLocalMedia]);

  // Bind video element when video toggled on
  useEffect(() => {
    if (isVideoOn && videoRef.current && localStreamRef.current) {
      videoRef.current.srcObject = localStreamRef.current;
    }
  }, [isVideoOn]);

  // ─── 6. Toggle Audio ───────────────────────────────────────────────────────────
  async function handleToggleAudio() {
    const next = !isAudioOn;
    setIsAudioOn(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = next; });
    if (currentParticipant?.id) {
      try { await updateParticipantMedia(meetingId, currentParticipant.id, { is_audio_on: next }); } catch { /* ignore */ }
    }
  }

  // ─── 7. Toggle Video ──────────────────────────────────────────────────────────
  async function handleToggleVideo() {
    const next = !isVideoOn;
    setIsVideoOn(next);
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = next; });
    if (currentParticipant?.id) {
      try { await updateParticipantMedia(meetingId, currentParticipant.id, { is_video_on: next }); } catch { /* ignore */ }
    }
  }

  // ─── 8. Screen Share ──────────────────────────────────────────────────────────
  // KEY FIX: We create a NEW MediaStream and call setLocalStream() so that the
  // useWebRTC hook sees the change and calls sender.replaceTrack() on all peers.
  async function handleToggleScreenShare() {
    if (isSharingScreen) {
      // ── Stop sharing ──
      if (screenTrackRef.current) {
        screenTrackRef.current.onended = null; // prevent recursive call
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }

      // Restore camera video track
      const camTrack = originalVideoTrackRef.current;
      if (camTrack) {
        camTrack.enabled = isVideoOn;
        const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
        const restoredStream = new MediaStream([camTrack, ...audioTracks]);
        localStreamRef.current = restoredStream;
        setLocalStream(restoredStream); // ← triggers WebRTC replaceTrack on all peers
        if (videoRef.current) videoRef.current.srcObject = restoredStream;
        originalVideoTrackRef.current = null;
      }
      setIsSharingScreen(false);
    } else {
      // ── Start sharing ──
      try {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          alert("Screen sharing is not supported on this device/browser.");
          return;
        }
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        const screenTrack = displayStream.getVideoTracks()[0];

        // Chromium motion hint prevents static-screen frame freeze
        if ("contentHint" in screenTrack) {
          (screenTrack as unknown as { contentHint: string }).contentHint = "motion";
        }
        screenTrackRef.current = screenTrack;

        // Save current camera track so we can restore it later
        const camTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
        if (camTrack) originalVideoTrackRef.current = camTrack;

        // Build new stream: screen video + existing audio
        const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
        const screenStream = new MediaStream([screenTrack, ...audioTracks]);
        localStreamRef.current = screenStream;
        setLocalStream(screenStream); // ← triggers WebRTC replaceTrack on all peers
        if (videoRef.current) videoRef.current.srcObject = screenStream;

        setIsSharingScreen(true);

        // Handle browser's native "Stop sharing" button
        screenTrack.onended = () => {
          handleToggleScreenShare();
        };
      } catch {
        // User cancelled or permission denied — do nothing
      }
    }
  }

  // ─── 9. Leave Meeting ─────────────────────────────────────────────────────────
  async function handleLeaveMeeting() {
    if (isLeavingRef.current) return;
    try {
      isLeavingRef.current = true;
      if (currentParticipant?.id) {
        await leaveMeeting(meetingId, currentParticipant.id);
      }
    } catch { /* ignore */ } finally {
      stopLocalMedia();
      if (typeof window !== "undefined") sessionStorage.removeItem(`zoom_participant_${meetingId}`);
      startTransition(() => router.push("/dashboard"));
    }
  }

  // ─── 10. End Meeting for All ──────────────────────────────────────────────────
  async function handleEndMeeting() {
    if (isEndingRef.current) return;
    if (!currentParticipant?.id || !token) return;
    try {
      isEndingRef.current = true;
      await endMeeting(meetingId, currentParticipant.id, token);
      setIsMeetingEnded(true);
    } catch { /* ignore */ } finally {
      stopLocalMedia();
      setIsEndModalOpen(false);
      startTransition(() => router.push("/dashboard"));
    }
  }

  // ─── 11. Host: Mute All ───────────────────────────────────────────────────────
  async function handleMuteAll() {
    if (isActionPendingRef.current || !currentParticipant?.id) return;
    if (!token) { alert("You must be signed in to perform this action."); return; }
    try {
      isActionPendingRef.current = true;
      const updated = await muteAllParticipants(meetingId, currentParticipant.id, token);
      setParticipants(updated);
      setIsAudioOn(false);
      localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = false; });
    } catch { alert("Failed to mute participants."); }
    finally { isActionPendingRef.current = false; }
  }

  // ─── 12. Host: Remove Participant ─────────────────────────────────────────────
  async function handleRemoveParticipant(participantId: number) {
    if (isActionPendingRef.current || !currentParticipant?.id) return;
    if (!token) { alert("You must be signed in to perform this action."); return; }
    if (!confirm("Are you sure you want to remove this participant?")) return;
    try {
      isActionPendingRef.current = true;
      await removeParticipant(meetingId, participantId, currentParticipant.id, token);
      setParticipants((prev) => prev.filter((p) => p.id !== participantId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to remove participant.");
    } finally { isActionPendingRef.current = false; }
  }

  // ─── 13. Host: Toggle Participant Audio (replaces separate Mute button) ────────
  async function handleToggleParticipantAudio(p: Participant) {
    if (isActionPendingRef.current || !currentParticipant?.id) return;
    try {
      isActionPendingRef.current = true;
      const updated = await updateParticipantMedia(meetingId, p.id, {
        is_audio_on: !p.is_audio_on,
      });
      setParticipants((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch { /* ignore */ }
    finally { isActionPendingRef.current = false; }
  }

  // ─── 14. Copy Invite Link ─────────────────────────────────────────────────────
  function copyInviteLink() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${origin}/meeting/${meetingId}/prejoin`;
    navigator.clipboard.writeText(`Join Zoom Meeting\nMeeting ID: ${meetingId}\nLink: ${inviteUrl}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  // ─── Derived values ───────────────────────────────────────────────────────────
  const isHost =
    currentParticipant?.role === "host" ||
    (Boolean(meeting?.host_name) &&
      Boolean(currentParticipant?.display_name) &&
      currentParticipant?.display_name?.trim().toLowerCase() === meeting?.host_name?.trim().toLowerCase());

  const isAuthenticatedHost =
    !!token && !!user && !!meeting?.host_user_id && meeting.host_user_id === user.id;

  const activeParticipants = participants.filter((p) => !p.left_at);
  const filteredParticipants = activeParticipants.filter((p) =>
    p.display_name.toLowerCase().includes(participantSearch.toLowerCase())
  );
  const remoteParticipants = activeParticipants.filter(
    (p) => !currentParticipant || p.id !== currentParticipant.id
  );

  const { remoteStreams } = useWebRTC(meetingId, currentParticipant?.id, localStream, remoteParticipants);

  const totalTiles = 1 + remoteParticipants.length;
  const gridClass =
    totalTiles === 1 ? "zm-grid-1" :
    totalTiles === 2 ? "zm-grid-2" :
    totalTiles <= 4 ? "zm-grid-4" : "zm-grid-multi";


  // ─── Loading / ended / removed screens ───────────────────────────────────────
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
            <Link href="/dashboard" className="zm-modal-btn danger" style={{ textDecoration: "none" }}>Return to Dashboard</Link>
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
            <Link href="/dashboard" className="zm-modal-btn secondary" style={{ textDecoration: "none" }}>Return to Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────────────
  return (
    <div className="zm-room-layout">
      <Navbar variant="workplace" />

      <div className="zm-room-main-container">
        {/* Left Sidebar */}
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

        {/* Central Meeting Viewport */}
        <section className="zm-room-viewport">
          {/* Top bar */}
          <div className="zm-viewport-header">
            <div className="zm-viewport-header-left" onClick={() => setIsShieldOpen((p) => !p)}>
              <button type="button" className="zm-info-icon-btn" title="Meeting Information">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </button>
              <span>{meeting?.title || "Zoom Meeting"}</span>
            </div>
            <div className="zm-viewport-header-right">
              <button type="button" className="zm-hdr-icon-btn zm-hdr-shield" title="Security" onClick={() => setIsShieldOpen((p) => !p)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
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
              <div className="zm-hdr-avatar-badge" title="Ashwin Toppo">zm</div>
            </div>

            {/* Meeting info dropdown */}
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
                  <span className="zm-shield-row-value" style={{ fontFamily: "monospace", color: "#2d8cff" }}>{meeting?.meeting_id}</span>
                </div>
                <div className="zm-shield-row">
                  <span className="zm-shield-row-label">Host</span>
                  <span className="zm-shield-row-value">{meeting?.host_name}</span>
                </div>
                <button type="button" className="zm-copy-link-btn" onClick={copyInviteLink}>
                  {copiedLink ? "✓ Invite Link Copied!" : "Copy Invite Link"}
                </button>
              </div>
            )}
          </div>

          {/* Video Canvas */}
          <div className="zm-room-video-canvas" onClick={() => { if (isShieldOpen) setIsShieldOpen(false); }}>
            <div className={`zm-grid ${gridClass}`}>
              {/* Local tile */}
              <div className="zm-video-tile">
                <video
                  ref={attachLocalVideo}
                  autoPlay
                  playsInline
                  muted
                  // Only mirror camera, NOT screen share
                  className={`zm-video-element${isSharingScreen ? "" : " mirrored"}`}
                  style={{ display: (isVideoOn || isSharingScreen) && !mediaPermissionDenied ? "block" : "none" }}
                />
                {(!isVideoOn && !isSharingScreen || mediaPermissionDenied) && (
                  <div className="zm-tile-avatar-view">
                    <div className="zm-tile-avatar">
                      {currentParticipant?.display_name ? currentParticipant.display_name.charAt(0).toUpperCase() : "A"}
                    </div>
                  </div>
                )}
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
                  <span>
                    {currentParticipant?.display_name || "You"}
                    {isSharingScreen && <span style={{ color: "#30d158", marginLeft: 4 }}>● Sharing</span>}
                  </span>
                </div>
              </div>

              {/* Remote participants */}
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

          {/* Participants Drawer */}
          {isParticipantsOpen && (
            <aside className="zm-side-drawer" style={{ position: "absolute", right: 0, top: 0, bottom: 64 }}>
              <div className="zm-drawer-header">
                <span className="zm-drawer-title">Participants ({activeParticipants.length || 1})</span>
                <button type="button" className="zm-drawer-close-btn" onClick={() => setIsParticipantsOpen(false)}>✕</button>
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
                {/* Self */}
                <div className="zm-participant-item">
                  <div className="zm-participant-info">
                    <div className="zm-participant-avatar">{currentParticipant?.display_name?.charAt(0).toUpperCase() || "A"}</div>
                    <div className="zm-participant-name">
                      {currentParticipant?.display_name || "Guest"}
                      <span className="zm-participant-tags">{isHost ? " (Host, me)" : " (me)"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span title={isAudioOn ? "Mic on" : "Muted"}>{isAudioOn ? <MicOnIcon /> : <MicOffIcon />}</span>
                    <span title={isVideoOn ? "Camera on" : "Camera off"}>{isVideoOn ? <CamOnIcon /> : <CamOffIcon />}</span>
                  </div>
                </div>

                {/* Others */}
                {filteredParticipants
                  .filter((p) => !currentParticipant || p.id !== currentParticipant.id)
                  .map((p) => (
                    <div key={p.id} className="zm-participant-item">
                      <div className="zm-participant-info">
                        <div className="zm-participant-avatar" style={{ backgroundColor: "#8a2be2" }}>
                          {p.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="zm-participant-name">
                          {p.display_name}
                          {p.role === "host" && <span className="zm-participant-tags"> (Host)</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {/* Mic icon — clickable for host to toggle participant audio */}
                        <span
                          title={p.is_audio_on ? (isHost ? "Click to mute" : "Mic on") : (isHost ? "Click to unmute" : "Muted")}
                          style={{ cursor: isHost ? "pointer" : "default" }}
                          onClick={isHost ? () => handleToggleParticipantAudio(p) : undefined}
                        >
                          {p.is_audio_on ? <MicOnIcon /> : <MicOffIcon />}
                        </span>
                        <span title={p.is_video_on ? "Camera on" : "Camera off"}>
                          {p.is_video_on ? <CamOnIcon /> : <CamOffIcon />}
                        </span>
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

          {/* Bottom Dock */}
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

              {/* Video */}
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

            {/* Center: Participants, Share Screen, Host tools, More */}
            <div className="zm-dock-center">
              {/* Participants */}
              <button
                type="button"
                className="zm-dock-item"
                onClick={() => setIsParticipantsOpen((p) => !p)}
              >
                <div className="zm-dock-item-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                  <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 2 }}>{activeParticipants.length || 1}</span>
                  <span className="zm-dock-caret">⌃</span>
                </div>
                <span>Participants</span>
              </button>

              {/* Share Screen */}
              <button
                type="button"
                className="zm-dock-item"
                onClick={handleToggleScreenShare}
                title={isSharingScreen ? "Stop Screen Share" : "Share Screen"}
                style={isSharingScreen ? { color: "#30d158" } : undefined}
              >
                <div className="zm-dock-item-icon">
                  {isSharingScreen ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#30d158" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" />
                      <line x1="4" y1="8" x2="20" y2="8" stroke="#30d158" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" />
                    </svg>
                  )}
                </div>
                <span>{isSharingScreen ? "Stop Share" : "Share Screen"}</span>
              </button>

              {/* Host tools (host only) */}
              {isHost && (
                <button
                  type="button"
                  className="zm-dock-item"
                  onClick={() => setIsShieldOpen((p) => !p)}
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

            {/* Right: End/Leave */}
            <div className="zm-dock-right">
              <button
                type="button"
                className="zm-end-circle-btn"
                onClick={() => setIsEndModalOpen(true)}
              >
                <div className="zm-end-circle-icon">✕</div>
                <span>{isAuthenticatedHost ? "End" : "Leave"}</span>
              </button>
            </div>
          </footer>
        </section>
      </div>

      {/* End / Leave Modal */}
      {isEndModalOpen && (
        <div className="zm-modal-backdrop" onClick={() => setIsEndModalOpen(false)}>
          <div className="zm-modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="zm-modal-title">
              {isAuthenticatedHost ? "End Meeting or Leave?" : "Leave Meeting"}
            </h2>
            <p className="zm-modal-desc">
              {isAuthenticatedHost
                ? "You can end the meeting for all participants, or leave the meeting."
                : "Are you sure you want to leave this meeting?"}
            </p>
            <div className="zm-modal-actions">
              {isAuthenticatedHost ? (
                <>
                  <button type="button" className="zm-modal-btn danger" onClick={handleEndMeeting}>End Meeting for All</button>
                  <button type="button" className="zm-modal-btn secondary" onClick={handleLeaveMeeting}>Leave Meeting</button>
                </>
              ) : (
                <button type="button" className="zm-modal-btn danger" onClick={handleLeaveMeeting}>Leave Meeting</button>
              )}
              <button type="button" className="zm-modal-btn cancel" onClick={() => setIsEndModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
