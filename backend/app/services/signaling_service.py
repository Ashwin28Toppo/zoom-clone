"""
WebRTC Signaling Service — manages WebSocket connections and fallback REST signal queues.
"""
from typing import Dict, List, Any, Optional
from fastapi import WebSocket
import json
import asyncio

class SignalingManager:
    def __init__(self):
        # meeting_id -> { participant_id: WebSocket }
        self.active_connections: Dict[str, Dict[int, WebSocket]] = {}
        # meeting_id -> { participant_id: [signal_data, ...] }
        self.signal_queues: Dict[str, Dict[int, List[Dict[str, Any]]]] = {}

    async def connect(self, meeting_id: str, participant_id: int, websocket: WebSocket):
        await websocket.accept()
        if meeting_id not in self.active_connections:
            self.active_connections[meeting_id] = {}
        self.active_connections[meeting_id][participant_id] = websocket

        # Notify other peers in this meeting that a new peer has connected
        await self.broadcast(
            meeting_id,
            sender_id=participant_id,
            signal_type="peer-joined",
            data={"participant_id": participant_id}
        )

    def disconnect(self, meeting_id: str, participant_id: int):
        if meeting_id in self.active_connections:
            self.active_connections[meeting_id].pop(participant_id, None)
            if not self.active_connections[meeting_id]:
                self.active_connections.pop(meeting_id, None)

    async def send_to_peer(self, meeting_id: str, sender_id: int, target_id: int, signal_type: str, data: Any):
        payload = {
            "sender_id": sender_id,
            "target_id": target_id,
            "signal_type": signal_type,
            "data": data,
        }
        # Check active WS connection
        ws = self.active_connections.get(meeting_id, {}).get(target_id)
        if ws:
            try:
                await ws.send_text(json.dumps(payload))
                return
            except Exception:
                self.disconnect(meeting_id, target_id)

        # Fallback to queue for REST polling
        if meeting_id not in self.signal_queues:
            self.signal_queues[meeting_id] = {}
        if target_id not in self.signal_queues[meeting_id]:
            self.signal_queues[meeting_id][target_id] = []
        self.signal_queues[meeting_id][target_id].append(payload)

    async def broadcast(self, meeting_id: str, sender_id: int, signal_type: str, data: Any):
        peers = self.active_connections.get(meeting_id, {})
        payload = {
            "sender_id": sender_id,
            "signal_type": signal_type,
            "data": data,
        }
        json_str = json.dumps(payload)
        dead_ids = []
        for pid, ws in peers.items():
            if pid != sender_id:
                try:
                    await ws.send_text(json_str)
                except Exception:
                    dead_ids.append(pid)

        for pid in dead_ids:
            self.disconnect(meeting_id, pid)

    def get_and_clear_queue(self, meeting_id: str, participant_id: int) -> List[Dict[str, Any]]:
        if meeting_id in self.signal_queues and participant_id in self.signal_queues[meeting_id]:
            signals = self.signal_queues[meeting_id][participant_id]
            self.signal_queues[meeting_id][participant_id] = []
            return signals
        return []

signaling_manager = SignalingManager()
