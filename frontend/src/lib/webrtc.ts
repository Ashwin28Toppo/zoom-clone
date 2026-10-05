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

  // Helper to send signal via WS or REST fallback
  const sendSignal = useCallback(
    async (targetId: number | undefined, signalType: string, data: unknown) => {
      if (!currentParticipantId) return;

      const payload = {
        sender_id: currentParticipantId,
        target_id: targetId,
        signal_type: signalType,
        data,
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify(payload));
          return;
        } catch {
          // fallback to REST
        }
      }

      // REST fallback
      try {
        await fetch(`${API_BASE_URL}/api/meetings/${meetingId}/signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        // network jitter
      }
    },
    [meetingId, currentParticipantId]
  );

  // Create or get PeerConnection for a specific peer
  const getOrCreatePeerConnection = useCallback(
    (peerId: number): RTCPeerConnection => {
      let pc = peerConnections.current.get(peerId);
      if (pc && pc.signalingState !== "closed") {
        return pc;
      }

      pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnections.current.set(peerId, pc);

      // Add local stream tracks
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc?.addTrack(track, localStream);
        });
      }

      // ICE Candidate handler
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(peerId, "ice-candidate", event.candidate.toJSON());
        }
      };

      // Remote Track handler (supports both event.streams and event.track fallback)
      pc.ontrack = (event) => {
        let stream: MediaStream | null = null;
        if (event.streams && event.streams[0]) {
          stream = event.streams[0];
        } else if (event.track) {
          stream = new MediaStream([event.track]);
        }

        if (stream) {
          const finalStream = stream;
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            const existing = next.get(peerId);
            if (existing) {
              if (event.track && !existing.getTracks().some((t) => t.id === event.track.id)) {
                existing.addTrack(event.track);
              }
              next.set(peerId, new MediaStream(existing.getTracks()));
            } else {
              next.set(peerId, finalStream);
            }
            return next;
          });
        }
      };

      // Connection State Change
      pc.onconnectionstatechange = () => {
        if (
          pc?.connectionState === "disconnected" ||
          pc?.connectionState === "failed" ||
          pc?.connectionState === "closed"
        ) {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
          });
        }
      };

      return pc;
    },
    [localStream, sendSignal]
  );

  // Initiate an offer to a peer
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

  // Handle incoming signals with polite peer collision resolution
  const handleSignal = useCallback(
    async (signal: SignalMessage) => {
      const peerId = signal.sender_id;
      if (peerId === currentParticipantId) return;

      const isPolite = (currentParticipantId || 0) > peerId;

      try {
        if (signal.signal_type === "peer-joined" || signal.signal_type === "ready") {
          // Initiate offer if we are the lower ID (impolite peer)
          if (!isPolite) {
            await initiateOffer(peerId);
          }
        } else if (signal.signal_type === "offer") {
          const pc = getOrCreatePeerConnection(peerId);
          const isOfferCollision =
            makingOffer.current.get(peerId) || pc.signalingState !== "stable";

          if (isOfferCollision && !isPolite) {
            return; // Impolite peer ignores colliding offer
          }

          if (isOfferCollision && isPolite) {
            await pc.setLocalDescription({ type: "rollback" });
          }

          // Attach local tracks if not attached
          if (localStream) {
            const senders = pc.getSenders();
            localStream.getTracks().forEach((track) => {
              if (!senders.some((s) => s.track?.id === track.id)) {
                try {
                  pc.addTrack(track, localStream);
                } catch {
                  // ignore
                }
              }
            });
          }

          await pc.setRemoteDescription(
            new RTCSessionDescription(signal.data as RTCSessionDescriptionInit)
          );

          // Process queued candidates
          const queued = pendingCandidates.current.get(peerId) || [];
          for (const cand of queued) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch {
              // ignore
            }
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

            // Process queued candidates
            const queued = pendingCandidates.current.get(peerId) || [];
            for (const cand of queued) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch {
                // ignore
              }
            }
            pendingCandidates.current.delete(peerId);
          }
        } else if (signal.signal_type === "ice-candidate") {
          const pc = peerConnections.current.get(peerId);
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.data as RTCIceCandidateInit));
            } catch {
              // candidate error
            }
          } else {
            if (!pendingCandidates.current.has(peerId)) {
              pendingCandidates.current.set(peerId, []);
            }
            pendingCandidates.current.get(peerId)?.push(signal.data as RTCIceCandidateInit);
          }
        } else if (signal.signal_type === "peer-left") {
          const pc = peerConnections.current.get(peerId);
          if (pc) {
            pc.close();
            peerConnections.current.delete(peerId);
          }
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(peerId);
            return next;
          });
        }
      } catch {
        // error handling
      }
    },
    [currentParticipantId, getOrCreatePeerConnection, initiateOffer, sendSignal, localStream]
  );

  // Sync local tracks with all existing peer connections when localStream changes
  useEffect(() => {
    if (!localStream) return;

    peerConnections.current.forEach((pc) => {
      if (pc.signalingState === "closed") return;
      const senders = pc.getSenders();

      localStream.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track).catch(() => {});
        } else {
          try {
            pc.addTrack(track, localStream);
          } catch {
            // ignore
          }
        }
      });
    });
  }, [localStream]);

  // Connect WebSocket & REST signaling
  useEffect(() => {
    if (!currentParticipantId) return;

    let isMounted = true;
    const wsUrl =
      API_BASE_URL.replace(/^http/, "ws") +
      `/api/meetings/${meetingId}/ws/${currentParticipantId}`;

    function connectWebSocket() {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          // Announce ready
          sendSignal(undefined, "ready", { participant_id: currentParticipantId });
        };

        ws.onmessage = (event) => {
          try {
            const signal = JSON.parse(event.data) as SignalMessage;
            handleSignal(signal);
          } catch {
            // json parse error
          }
        };

        ws.onclose = () => {
          if (isMounted) {
            setTimeout(connectWebSocket, 3000);
          }
        };
      } catch {
        // ws connect error
      }
    }

    connectWebSocket();

    // REST polling fallback (every 1.5s)
    const interval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/meetings/${meetingId}/signals?participant_id=${currentParticipantId}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.signals && Array.isArray(data.signals)) {
            for (const s of data.signals) {
              handleSignal(s);
            }
          }
        }
      } catch {
        // polling error
      }
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [meetingId, currentParticipantId, handleSignal, sendSignal]);

  // Automatically initiate offers for any remote participants
  useEffect(() => {
    if (!currentParticipantId) return;

    remoteParticipants.forEach((p) => {
      const isPolite = currentParticipantId > p.id;
      if (!isPolite && !peerConnections.current.has(p.id)) {
        initiateOffer(p.id);
      }
    });
  }, [remoteParticipants, currentParticipantId, initiateOffer]);

  // Cleanup on unmount
  useEffect(() => {
    const pcs = peerConnections.current;
    return () => {
      pcs.forEach((pc) => {
        try {
          pc.close();
        } catch {
          // ignore
        }
      });
      pcs.clear();
    };
  }, []);

  return { remoteStreams };
}
