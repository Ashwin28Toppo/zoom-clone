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
    """Get a specific meeting by its meeting ID."""
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
    """Join an existing meeting as a participant."""
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
