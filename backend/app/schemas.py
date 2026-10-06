from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import Optional, List


# ─── Auth Schemas ──────────────────────────────────────────────────────────────

class UserSignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)


class UserLoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ─── Meeting Request Schemas ───────────────────────────────────────────────────

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
    reconnect_participant_id: Optional[int] = None  # For page-refresh reconnects


class UpdateMediaStateRequest(BaseModel):
    is_audio_on: Optional[bool] = None
    is_video_on: Optional[bool] = None


# ─── Response Schemas ──────────────────────────────────────────────────────────

class ParticipantResponse(BaseModel):
    id: int
    meeting_id: str
    display_name: str
    role: str
    is_audio_on: bool
    is_video_on: bool
    joined_at: datetime
    left_at: Optional[datetime] = None
    last_seen: Optional[datetime] = None

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
    host_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    participant_count: int = 0
    participants: List[ParticipantResponse] = []

    class Config:
        from_attributes = True


class MeetingListResponse(BaseModel):
    meetings: List[MeetingResponse]
    total: int
