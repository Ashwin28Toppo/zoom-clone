from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


# ─── Request Schemas ───────────────────────────────────────────

class CreateInstantMeetingRequest(BaseModel):
    title: Optional[str] = None
    host_name: Optional[str] = "Ashwin Toppo"


class CreateScheduledMeetingRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    scheduled_at: datetime
    duration: int = Field(default=60, ge=15, le=480)
    host_name: Optional[str] = "Ashwin Toppo"


class JoinMeetingRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=255)
    is_audio_on: bool = True
    is_video_on: bool = True


class UpdateMediaStateRequest(BaseModel):
    is_audio_on: Optional[bool] = None
    is_video_on: Optional[bool] = None


# ─── Response Schemas ──────────────────────────────────────────

class ParticipantResponse(BaseModel):
    id: int
    meeting_id: str
    display_name: str
    role: str
    is_audio_on: bool
    is_video_on: bool
    joined_at: datetime
    left_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MeetingResponse(BaseModel):
    id: int
    meeting_id: str
    title: str
    description: Optional[str] = None
    meeting_type: str
    scheduled_at: Optional[datetime] = None
    duration: int
    invite_link: Optional[str] = None
    status: str
    host_name: str
    created_at: datetime
    updated_at: datetime
    participant_count: int = 0
    participants: List[ParticipantResponse] = []

    class Config:
        from_attributes = True


class MeetingListResponse(BaseModel):
    meetings: List[MeetingResponse]
    total: int
