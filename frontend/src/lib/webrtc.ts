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
  ],
};

interface SignalMessage {
  sender_id: number;
  target_id?: number;
  signal_type: "offer" | "answer" | "ice-candidate" | "peer-joined" | "peer-left";
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
          sendSignal(peerId, "ice-candidate", event.candidate);
        }
      };

      // Remote Track handler
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.set(peerId, stream);
            return next;
          });
        }
      };

      // Connection State Change
      pc.onconnectionstatechange = () => {
        if (pc?.connectionState === "disconnected" || pc?.connectionState === "failed" || pc?.connectionState === "closed") {
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
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        await sendSignal(peerId, "offer", offer);
      } catch {
        // offer error
      }
    },
    [getOrCreatePeerConnection, sendSignal]
  );

  // Handle incoming signals
  const handleSignal = useCallback(
    async (signal: SignalMessage) => {
      const peerId = signal.sender_id;
      if (peerId === currentParticipantId) return;

      try {
        if (signal.signal_type === "peer-joined") {
          // If we have a lower ID or are host, initiate the offer
          if (!currentParticipantId || currentParticipantId < peerId) {
            await initiateOffer(peerId);
          }
        } else if (signal.signal_type === "offer") {
          const pc = getOrCreatePeerConnection(peerId);
          await pc.setRemoteDescription(new RTCSessionDescription(signal.data as RTCSessionDescriptionInit));

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
            await pc.setRemoteDescription(new RTCSessionDescription(signal.data as RTCSessionDescriptionInit));

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
            // Queue candidate until remote description is set
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
        // signal processing error
      }
    },
    [currentParticipantId, getOrCreatePeerConnection, initiateOffer, sendSignal]
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
    const wsUrl = API_BASE_URL.replace(/^http/, "ws") + `/api/meetings/${meetingId}/ws/${currentParticipantId}`;

    function connectWebSocket() {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

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
            // Retry connecting after 3s
            setTimeout(connectWebSocket, 3000);
          }
        };
      } catch {
        // ws connect error
      }
    }

    connectWebSocket();

    // REST polling fallback (every 2s)
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
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [meetingId, currentParticipantId, handleSignal]);

  // Automatically initiate offers for any new remote participants in room
  useEffect(() => {
    if (!currentParticipantId) return;

    remoteParticipants.forEach((p) => {
      if (!peerConnections.current.has(p.id)) {
        if (currentParticipantId < p.id) {
          initiateOffer(p.id);
        }
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
