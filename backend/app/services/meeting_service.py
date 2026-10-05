"""
Meeting service — business logic for all meeting operations.
"""
import random
import string
from datetime import datetime

from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..models import Meeting, Participant
from ..schemas import (
    CreateInstantMeetingRequest,
    CreateScheduledMeetingRequest,
    JoinMeetingRequest,
    MeetingResponse,
    ParticipantResponse,
    UpdateMediaStateRequest,
)


def generate_meeting_id(db: Session) -> str:
    """Generate a unique 12-character numeric meeting ID."""
    while True:
        digits = "".join(random.choices(string.digits, k=12))
        exists = db.query(Meeting).filter(Meeting.meeting_id == digits).first()
        if not exists:
            return digits


def _to_meeting_response(meeting: Meeting) -> MeetingResponse:
    """Convert a Meeting ORM object to a MeetingResponse schema."""
    active_participants = [p for p in meeting.participants if p.left_at is None]
    return MeetingResponse(
        id=meeting.id,
        meeting_id=meeting.meeting_id,
        title=meeting.title,
        description=meeting.description,
        meeting_type=meeting.meeting_type,
        scheduled_at=meeting.scheduled_at,
        duration=meeting.duration,
        invite_link=meeting.invite_link,
        status=meeting.status,
        host_name=meeting.host_name,
        created_at=meeting.created_at,
        updated_at=meeting.updated_at,
        participant_count=len(active_participants),
        participants=[
            ParticipantResponse.model_validate(p) for p in active_participants
        ],
    )


def create_instant_meeting(
    db: Session, request: CreateInstantMeetingRequest
) -> MeetingResponse:
    meeting_id = generate_meeting_id(db)
    host_name = request.host_name or "Ashwin Toppo"
    title = request.title or f"{host_name}'s Zoom Meeting"

    meeting = Meeting(
        meeting_id=meeting_id,
        title=title,
        meeting_type="instant",
        status="waiting",
        host_name=host_name,
        duration=60,
        invite_link=f"/meeting/{meeting_id}",
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return _to_meeting_response(meeting)


def create_scheduled_meeting(
    db: Session, request: CreateScheduledMeetingRequest
) -> MeetingResponse:
    meeting_id = generate_meeting_id(db)

    meeting = Meeting(
        meeting_id=meeting_id,
        title=request.title,
        description=request.description,
        meeting_type="scheduled",
        scheduled_at=request.scheduled_at,
        duration=request.duration,
        status="waiting",
        host_name=request.host_name or "Ashwin Toppo",
        invite_link=f"/meeting/{meeting_id}",
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return _to_meeting_response(meeting)


def get_meeting_by_id(db: Session, meeting_id: str) -> MeetingResponse | None:
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        return None
    return _to_meeting_response(meeting)


def get_upcoming_meetings(db: Session) -> list[MeetingResponse]:
    now = datetime.utcnow()
    meetings = (
        db.query(Meeting)
        .filter(
            Meeting.meeting_type == "scheduled",
            Meeting.status != "ended",
            Meeting.scheduled_at > now,
        )
        .order_by(Meeting.scheduled_at)
        .limit(20)
        .all()
    )
    return [_to_meeting_response(m) for m in meetings]


def get_recent_meetings(db: Session) -> list[MeetingResponse]:
    meetings = (
        db.query(Meeting)
        .filter(Meeting.status == "ended")
        .order_by(desc(Meeting.updated_at))
        .limit(20)
        .all()
    )
    return [_to_meeting_response(m) for m in meetings]


def join_meeting(
    db: Session, meeting_id: str, request: JoinMeetingRequest
) -> ParticipantResponse:
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        raise ValueError("Meeting not found")

    if meeting.status == "ended":
        raise ValueError("This meeting has already ended")

    # Activate the meeting when first participant joins
    if meeting.status == "waiting":
        meeting.status = "active"
        meeting.updated_at = datetime.utcnow()

    # Check if this participant is already in the meeting
    existing = (
        db.query(Participant)
        .filter(
            Participant.meeting_id == meeting_id,
            Participant.display_name == request.display_name,
            Participant.left_at.is_(None),
        )
        .first()
    )
    if existing:
        existing.is_audio_on = request.is_audio_on
        existing.is_video_on = request.is_video_on
        db.commit()
        db.refresh(existing)
        return ParticipantResponse.model_validate(existing)

    # First participant becomes host
    active_count = (
        db.query(Participant)
        .filter(Participant.meeting_id == meeting_id, Participant.left_at.is_(None))
        .count()
    )
    role = "host" if active_count == 0 else "participant"

    participant = Participant(
        meeting_id=meeting_id,
        display_name=request.display_name,
        role=role,
        is_audio_on=request.is_audio_on,
        is_video_on=request.is_video_on,
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return ParticipantResponse.model_validate(participant)


def leave_meeting(db: Session, meeting_id: str, participant_id: int) -> bool:
    participant = (
        db.query(Participant)
        .filter(
            Participant.id == participant_id,
            Participant.meeting_id == meeting_id,
        )
        .first()
    )
    if not participant:
        return False

    participant.left_at = datetime.utcnow()
    db.commit()
    return True


def end_meeting(db: Session, meeting_id: str) -> MeetingResponse | None:
    meeting = db.query(Meeting).filter(Meeting.meeting_id == meeting_id).first()
    if not meeting:
        return None

    meeting.status = "ended"
    meeting.updated_at = datetime.utcnow()

    # Mark all active participants as left
    active = (
        db.query(Participant)
        .filter(
            Participant.meeting_id == meeting_id,
            Participant.left_at.is_(None),
        )
        .all()
    )
    for p in active:
        p.left_at = datetime.utcnow()

    db.commit()
    db.refresh(meeting)
    return _to_meeting_response(meeting)


def get_participants(db: Session, meeting_id: str) -> list[ParticipantResponse]:
    participants = (
        db.query(Participant)
        .filter(
            Participant.meeting_id == meeting_id,
            Participant.left_at.is_(None),
        )
        .all()
    )
    return [ParticipantResponse.model_validate(p) for p in participants]


def update_participant_media(
    db: Session,
    meeting_id: str,
    participant_id: int,
    request: UpdateMediaStateRequest,
) -> ParticipantResponse | None:
    """Update participant audio/video toggle states."""
    participant = (
        db.query(Participant)
        .filter(
            Participant.id == participant_id,
            Participant.meeting_id == meeting_id,
            Participant.left_at.is_(None),
        )
        .first()
    )
    if not participant:
        return None

    if request.is_audio_on is not None:
        participant.is_audio_on = request.is_audio_on
    if request.is_video_on is not None:
        participant.is_video_on = request.is_video_on

    db.commit()
    db.refresh(participant)
    return ParticipantResponse.model_validate(participant)


def _get_active_participant(db: Session, meeting_id: str, participant_id: int) -> Participant | None:
    """Fetch an active (not-left) participant by id within a meeting."""
    return (
        db.query(Participant)
        .filter(
            Participant.id == participant_id,
            Participant.meeting_id == meeting_id,
            Participant.left_at.is_(None),
        )
        .first()
    )


def _assert_host(db: Session, meeting_id: str, requester_id: int) -> Participant:
    """Raise ValueError if requester is not an active host in this meeting."""
    requester = _get_active_participant(db, meeting_id, requester_id)
    if not requester:
        raise ValueError("Requester is not an active participant in this meeting")
    if requester.role != "host":
        raise ValueError("Only the host is allowed to perform this action")
    return requester


def mute_all_participants(db: Session, meeting_id: str, requester_id: int) -> list[ParticipantResponse]:
    """Mute all active participants in a meeting (host control only)."""
    _assert_host(db, meeting_id, requester_id)
    participants = (
        db.query(Participant)
        .filter(
            Participant.meeting_id == meeting_id,
            Participant.left_at.is_(None),
        )
        .all()
    )
    for p in participants:
        p.is_audio_on = False
    db.commit()
    return [ParticipantResponse.model_validate(p) for p in participants]


def remove_participant(db: Session, meeting_id: str, participant_id: int, requester_id: int) -> bool:
    """Remove/kick a participant from the meeting.

    Rules enforced:
    - Only a host (requester_id must be an active host) may remove others.
    - The host cannot be removed by anyone, including another host call.
    - A participant cannot remove themselves via this endpoint (use leave_meeting).
    """
    _assert_host(db, meeting_id, requester_id)

    # Prevent removing the host (self or otherwise)
    target = _get_active_participant(db, meeting_id, participant_id)
    if not target:
        return False
    if target.role == "host":
        raise ValueError("The host cannot be removed from the meeting")

    return leave_meeting(db, meeting_id, participant_id)

