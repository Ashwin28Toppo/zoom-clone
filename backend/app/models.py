from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from .database import Base


class User(Base):
    """Authenticated user account."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(512), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    meetings = relationship("Meeting", back_populates="host_user", foreign_keys="Meeting.host_user_id")


class Meeting(Base):
    """Represents a meeting (instant or scheduled)."""
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    meeting_id = Column(String(12), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    meeting_type = Column(String(20), nullable=False)  # "instant" or "scheduled"
    scheduled_at = Column(DateTime, nullable=True, index=True)
    duration = Column(Integer, default=60)  # in minutes
    status = Column(String(20), default="waiting", index=True)  # waiting, active, ended
    host_name = Column(String(255), default="Ashwin Toppo")  # display name
    host_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    invite_link = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    host_user = relationship("User", back_populates="meetings", foreign_keys=[host_user_id])
    participants = relationship(
        "Participant", back_populates="meeting", cascade="all, delete-orphan"
    )


class Participant(Base):
    """Represents a participant in a meeting."""
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    meeting_id = Column(
        String(12),
        ForeignKey("meetings.meeting_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    display_name = Column(String(255), nullable=False)
    role = Column(String(20), default="participant")  # host, participant
    is_audio_on = Column(Boolean, default=True)
    is_video_on = Column(Boolean, default=True)
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime, nullable=True)
    last_seen = Column(DateTime, default=datetime.utcnow, nullable=True)  # heartbeat presence

    meeting = relationship("Meeting", back_populates="participants")
