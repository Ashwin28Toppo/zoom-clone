"""
Meeting API routes — all REST endpoints for meeting operations.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import (
    CreateInstantMeetingRequest,
    CreateScheduledMeetingRequest,
    JoinMeetingRequest,
    MeetingResponse,
    MeetingListResponse,
    ParticipantResponse,
    UpdateMediaStateRequest,
)
from ..services import meeting_service

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


@router.post("/instant", response_model=MeetingResponse, status_code=201)
def create_instant_meeting(
    request: CreateInstantMeetingRequest = CreateInstantMeetingRequest(),
    db: Session = Depends(get_db),
):
    """Create a new instant meeting and return its details."""
    return meeting_service.create_instant_meeting(db, request)


@router.post("/schedule", response_model=MeetingResponse, status_code=201)
def create_scheduled_meeting(
    request: CreateScheduledMeetingRequest,
    db: Session = Depends(get_db),
):
    """Create a new scheduled meeting."""
    return meeting_service.create_scheduled_meeting(db, request)


@router.get("/upcoming", response_model=MeetingListResponse)
def get_upcoming_meetings(db: Session = Depends(get_db)):
    """Get all upcoming scheduled meetings."""
    meetings = meeting_service.get_upcoming_meetings(db)
    return MeetingListResponse(meetings=meetings, total=len(meetings))


@router.get("/recent", response_model=MeetingListResponse)
def get_recent_meetings(db: Session = Depends(get_db)):
    """Get recently ended meetings."""
    meetings = meeting_service.get_recent_meetings(db)
    return MeetingListResponse(meetings=meetings, total=len(meetings))


@router.get("/{meeting_id}", response_model=MeetingResponse)
def get_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Get a specific meeting by its meeting ID (validates meeting existence)."""
    meeting = meeting_service.get_meeting_by_id(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.post("/{meeting_id}/join", response_model=ParticipantResponse)
def join_meeting(
    meeting_id: str,
    request: JoinMeetingRequest,
    db: Session = Depends(get_db),
):
    """Join an existing meeting as a participant with display name and initial media states."""
    try:
        return meeting_service.join_meeting(db, meeting_id, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{meeting_id}/leave")
def leave_meeting(
    meeting_id: str,
    participant_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Leave a meeting (mark participant as left)."""
    success = meeting_service.leave_meeting(db, meeting_id, participant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Participant not found")
    return {"message": "Left meeting successfully"}


@router.patch("/{meeting_id}/participants/{participant_id}/media", response_model=ParticipantResponse)
def update_participant_media(
    meeting_id: str,
    participant_id: int,
    request: UpdateMediaStateRequest,
    db: Session = Depends(get_db),
):
    """Update participant audio/video toggle states."""
    participant = meeting_service.update_participant_media(db, meeting_id, participant_id, request)
    if not participant:
        raise HTTPException(status_code=404, detail="Active participant not found")
    return participant


@router.post("/{meeting_id}/mute-all", response_model=list[ParticipantResponse])
def mute_all_participants(
    meeting_id: str,
    db: Session = Depends(get_db),
):
    """Mute all active participants in a meeting (host control)."""
    return meeting_service.mute_all_participants(db, meeting_id)


@router.delete("/{meeting_id}/participants/{participant_id}")
def remove_participant(
    meeting_id: str,
    participant_id: int,
    db: Session = Depends(get_db),
):
    """Remove/kick a participant from the meeting (host control)."""
    success = meeting_service.remove_participant(db, meeting_id, participant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Participant not found")
    return {"message": "Participant removed successfully"}


@router.put("/{meeting_id}/end", response_model=MeetingResponse)
def end_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """End a meeting and mark all participants as left."""
    meeting = meeting_service.end_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.get("/{meeting_id}/participants", response_model=list[ParticipantResponse])
def get_participants(meeting_id: str, db: Session = Depends(get_db)):
    """Get all active participants in a meeting."""
    return meeting_service.get_participants(db, meeting_id)


# WebRTC Signaling Routes
from fastapi import WebSocket, WebSocketDisconnect
from ..services.signaling_service import signaling_manager
from pydantic import BaseModel
from typing import Any, Optional

class SignalPayload(BaseModel):
    sender_id: int
    target_id: Optional[int] = None
    signal_type: str
    data: Any

@router.websocket("/{meeting_id}/ws/{participant_id}")
async def websocket_signaling(websocket: WebSocket, meeting_id: str, participant_id: int):
    """WebSocket endpoint for ultra-low-latency WebRTC peer signaling."""
    await signaling_manager.connect(meeting_id, participant_id, websocket)
    try:
        while True:
            text = await websocket.receive_text()
            import json
            payload = json.loads(text)
            target_id = payload.get("target_id")
            signal_type = payload.get("signal_type")
            data = payload.get("data")
            if target_id is not None:
                await signaling_manager.send_to_peer(meeting_id, participant_id, target_id, signal_type, data)
            else:
                await signaling_manager.broadcast(meeting_id, participant_id, signal_type, data)
    except WebSocketDisconnect:
        signaling_manager.disconnect(meeting_id, participant_id)
        await signaling_manager.broadcast(meeting_id, participant_id, "peer-left", {"participant_id": participant_id})
    except Exception:
        signaling_manager.disconnect(meeting_id, participant_id)


@router.post("/{meeting_id}/signal")
async def post_signal(meeting_id: str, payload: SignalPayload):
    """REST fallback endpoint to send WebRTC signals."""
    if payload.target_id is not None:
        await signaling_manager.send_to_peer(
            meeting_id, payload.sender_id, payload.target_id, payload.signal_type, payload.data
        )
    else:
        await signaling_manager.broadcast(
            meeting_id, payload.sender_id, payload.signal_type, payload.data
        )
    return {"status": "sent"}


@router.get("/{meeting_id}/signals")
def get_signals(meeting_id: str, participant_id: int = Query(...)):
    """REST fallback endpoint to fetch pending WebRTC signals."""
    signals = signaling_manager.get_and_clear_queue(meeting_id, participant_id)
    return {"signals": signals}

