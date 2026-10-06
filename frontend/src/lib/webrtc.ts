"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Participant } from "./api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ],
  iceCandidatePoolSize: 10,
};

interface SignalMessage {
  sender_id: number;
  target_id?: number;
  signal_type: "offer" | "answer" | "ice-candidate" | "peer-joined" | "peer-left" | "ready";
  data: unknown;
}

export function useWebRTC(
  meetingId: string,
  currentParticipantId: number | undefined,
  localStream: MediaStream | null,
  remoteParticipants: Participant[]
) {
  const [remoteStreams, setRemoteStreams] = useState<Map<number, MediaStream>>(new Map());
  const peerConnections = useRef<Map<number, RTCPeerConnection>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const pendingCandidates = useRef<Map<number, RTCIceCandidateInit[]>>(new Map());
  const makingOffer = useRef<Map<number, boolean>>(new Map());

  // Refs so callbacks don't need to be recreated when these change.
  // This prevents the WebSocket from disconnecting/reconnecting on every
  // screen-share toggle or stream update.
  const localStreamRef = useRef<MediaStream | null>(localStream);
  const currentParticipantIdRef = useRef<number | undefined>(currentParticipantId);
  const meetingIdRef = useRef<string>(meetingId);

  // Keep refs in sync with latest prop values
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { currentParticipantIdRef.current = currentParticipantId; }, [currentParticipantId]);
  useEffect(() => { meetingIdRef.current = meetingId; }, [meetingId]);

  // ─── Signal sending (stable — reads from refs) ────────────────────────────
  const sendSignal = useCallback(
    async (targetId: number | undefined, signalType: string, data: unknown) => {
      const myId = currentParticipantIdRef.current;
      const mid = meetingIdRef.current;
      if (!myId) return;

      const payload = {
        sender_id: myId,
        target_id: targetId,
        signal_type: signalType,
        data,
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify(payload));
          return;
        } catch {
          // fall through to REST
        }
      }

      try {
        await fetch(`${API_BASE_URL}/api/meetings/${mid}/signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        // network jitter
      }
    },
    [] // stable — uses refs internally
  );

  // ─── PeerConnection factory ────────────────────────────────────────────────
  const getOrCreatePeerConnection = useCallback(
    (peerId: number): RTCPeerConnection => {
      let pc = peerConnections.current.get(peerId);
      if (pc && pc.signalingState !== "closed") return pc;

      pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnections.current.set(peerId, pc);

      // Add current local tracks (reads from ref, not prop)
      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => {
          pc!.addTrack(track, stream);
        });
      }

      // ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(peerId, "ice-candidate", event.candidate.toJSON());
        }
      };

      // Remote tracks → update remoteStreams map
      pc.ontrack = (event) => {
        const incomingStream: MediaStream | null =
          event.streams && event.streams[0]
            ? event.streams[0]
            : event.track
            ? new MediaStream([event.track])
            : null;

        if (!incomingStream) return;

        setRemoteStreams((prev) => {
          const next = new Map(prev);
          const existing = next.get(peerId);
          if (existing) {
            // Add any new tracks that aren't already in the existing stream
            if (event.track && !existing.getTracks().some((t) => t.id === event.track.id)) {
              existing.addTrack(event.track);
            }
            // Create a new MediaStream reference so React sees the update
            next.set(peerId, new MediaStream(existing.getTracks()));
          } else {
            next.set(peerId, incomingStream);
          }
          return next;
        });
      };

      // Auto-renegotiate (track swap triggers this)
      pc.onnegotiationneeded = async () => {
        try {
          if (makingOffer.current.get(peerId)) return;
          makingOffer.current.set(peerId, true);
          const offer = await pc!.createOffer();
          if (pc!.signalingState !== "stable") return;
          await pc!.setLocalDescription(offer);
          await sendSignal(peerId, "offer", offer);
        } catch {
          // ignore
        } finally {
          makingOffer.current.set(peerId, false);
        }
      };

      // Connection state changes
      pc.onconnectionstatechange = () => {
        if (pc?.connectionState === "failed") {
          // Retry offer
          initiateOfferRef.current?.(peerId);
        } else if (pc?.connectionState === "closed") {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
          });
        }
      };

      return pc;
    },
    [sendSignal] // stable — localStream read via ref
  );

  // ─── Initiate an offer to a peer ─────────────────────────────────────────
  const initiateOffer = useCallback(
    async (peerId: number) => {
      try {
        const pc = getOrCreatePeerConnection(peerId);
        makingOffer.current.set(peerId, true);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        if (pc.signalingState !== "stable") return;
        await pc.setLocalDescription(offer);
        await sendSignal(peerId, "offer", offer);
      } catch {
        // offer error
      } finally {
        makingOffer.current.set(peerId, false);
      }
    },
    [getOrCreatePeerConnection, sendSignal]
  );

  // Stable ref to initiateOffer for use inside callbacks
  const initiateOfferRef = useRef<((peerId: number) => Promise<void>) | null>(null);
  useEffect(() => { initiateOfferRef.current = initiateOffer; }, [initiateOffer]);

  // ─── Handle incoming signals ──────────────────────────────────────────────
  const handleSignal = useCallback(
    async (signal: SignalMessage) => {
      const myId = currentParticipantIdRef.current;
      const peerId = signal.sender_id;
      if (peerId === myId) return;

      const isPolite = (myId || 0) > peerId;

      try {
        if (signal.signal_type === "peer-joined" || signal.signal_type === "ready") {
          if (!isPolite) {
            await initiateOfferRef.current?.(peerId);
          }
        } else if (signal.signal_type === "offer") {
          const pc = getOrCreatePeerConnection(peerId);
          const isCollision = makingOffer.current.get(peerId) || pc.signalingState !== "stable";

          if (isCollision && !isPolite) return; // Impolite peer drops colliding offer
          if (isCollision && isPolite) {
            await pc.setLocalDescription({ type: "rollback" });
          }

          // Ensure local tracks are attached
          const stream = localStreamRef.current;
          if (stream) {
            const senders = pc.getSenders();
            stream.getTracks().forEach((track) => {
              if (!senders.some((s) => s.track?.id === track.id)) {
                try { pc.addTrack(track, stream); } catch { /* ignore */ }
              }
            });
          }

          await pc.setRemoteDescription(
            new RTCSessionDescription(signal.data as RTCSessionDescriptionInit)
          );

          // Flush queued ICE candidates
          const queued = pendingCandidates.current.get(peerId) || [];
          for (const cand of queued) {
            try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch { /* ignore */ }
          }
          pendingCandidates.current.delete(peerId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(peerId, "answer", answer);
        } else if (signal.signal_type === "answer") {
          const pc = peerConnections.current.get(peerId);
          if (pc && pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(
              new RTCSessionDescription(signal.data as RTCSessionDescriptionInit)
            );
            const queued = pendingCandidates.current.get(peerId) || [];
            for (const cand of queued) {
              try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch { /* ignore */ }
            }
            pendingCandidates.current.delete(peerId);
          }
        } else if (signal.signal_type === "ice-candidate") {
          const pc = peerConnections.current.get(peerId);
          if (pc && pc.remoteDescription?.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.data as RTCIceCandidateInit));
            } catch { /* ignore */ }
          } else {
            const q = pendingCandidates.current.get(peerId) ?? [];
            q.push(signal.data as RTCIceCandidateInit);
            pendingCandidates.current.set(peerId, q);
          }
        } else if (signal.signal_type === "peer-left") {
          const pc = peerConnections.current.get(peerId);
          if (pc) { pc.close(); peerConnections.current.delete(peerId); }
          setRemoteStreams((prev) => { const next = new Map(prev); next.delete(peerId); return next; });
        }
      } catch {
        // signal handling error
      }
    },
    [getOrCreatePeerConnection, sendSignal] // stable; myId read via ref
  );

  // Stable ref so WS onmessage always calls latest handleSignal without re-subscribing
  const handleSignalRef = useRef<((sig: SignalMessage) => Promise<void>) | null>(null);
  useEffect(() => { handleSignalRef.current = handleSignal; }, [handleSignal]);

  // ─── Replace tracks on ALL peer connections when localStream changes ──────
  // This is the core of screen-sharing: when page.tsx calls setLocalStream()
  // with a new stream (e.g. screen track), this effect fires and calls
  // sender.replaceTrack() on every active peer connection.
  useEffect(() => {
    if (!localStream) return;

    peerConnections.current.forEach((pc) => {
      if (pc.signalingState === "closed") return;
      const senders = pc.getSenders();

      localStream.getTracks().forEach((track) => {
        // Match sender by track kind (audio/video)
        const sender = senders.find((s) => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track).catch(() => {});
        } else {
          try { pc.addTrack(track, localStream); } catch { /* ignore */ }
        }
      });
    });
  }, [localStream]);

  // ─── WebSocket + REST polling signaling ───────────────────────────────────
  // Deliberately stable deps so the WS never reconnects due to stream changes.
  useEffect(() => {
    if (!currentParticipantId) return;

    let isMounted = true;
    const mid = meetingId;
    const myId = currentParticipantId;
    const wsUrl =
      API_BASE_URL.replace(/^http/, "ws") + `/api/meetings/${mid}/ws/${myId}`;

    function connectWebSocket() {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          sendSignal(undefined, "ready", { participant_id: myId });
        };

        ws.onmessage = (event) => {
          try {
            const signal = JSON.parse(event.data) as SignalMessage;
            handleSignalRef.current?.(signal);
          } catch { /* json error */ }
        };

        ws.onclose = () => {
          if (isMounted) setTimeout(connectWebSocket, 3000);
        };
      } catch { /* connect error */ }
    }

    connectWebSocket();

    // REST polling fallback (every 1.5 s)
    const interval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/meetings/${mid}/signals?participant_id=${myId}`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.signals)) {
            for (const s of data.signals) handleSignalRef.current?.(s);
          }
        }
      } catch { /* polling error */ }
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
    // Only reconnect if meeting/participant changes — NOT on stream changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, currentParticipantId]);

  // ─── Auto-initiate offers for new remote participants ─────────────────────
  // Higher-ID peer initiates immediately (it knows it's the offerer).
  // Lower-ID peer relies on peer-joined/ready WS signal to initiate.
  // Safety fallback: if lower-ID peer sees a new remote participant but still
  // has no connection after 3 seconds (e.g. WS signal was missed), it initiates.
  useEffect(() => {
    if (!currentParticipantId) return;
    remoteParticipants.forEach((p) => {
      const existing = peerConnections.current.get(p.id);
      if (existing && existing.signalingState !== "closed") return; // already connected
      if (currentParticipantId > p.id) {
        // Higher-ID initiates immediately
        initiateOfferRef.current?.(p.id);
      } else {
        // Lower-ID: fallback after 3s if peer-joined/ready signal was missed
        const peerId = p.id;
        setTimeout(() => {
          const pc = peerConnections.current.get(peerId);
          if (!pc || pc.signalingState === "closed") {
            initiateOfferRef.current?.(peerId);
          }
        }, 3000);
      }
    });
  }, [remoteParticipants, currentParticipantId]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    const pcs = peerConnections.current;
    return () => {
      pcs.forEach((pc) => { try { pc.close(); } catch { /* ignore */ } });
      pcs.clear();
    };
  }, []);

  return { remoteStreams };
}
