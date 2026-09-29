"""
Database seed script — creates realistic sample meetings for development.
Run automatically on startup if the database is empty.
"""
from datetime import datetime, timedelta

from .database import SessionLocal
from .models import Meeting, Participant


def seed_database():
    """Insert sample meetings and participants if the database is empty."""
    db = SessionLocal()

    # Skip if data already exists
    if db.query(Meeting).first():
        db.close()
        return

    now = datetime.utcnow()

    # ── Upcoming scheduled meetings ──────────────────────────────
    upcoming = [
        Meeting(
            meeting_id="123456789001",
            title="Team Sprint Planning",
            description="Weekly sprint planning session to review backlog and assign tasks for Q4",
            meeting_type="scheduled",
            scheduled_at=now + timedelta(hours=3),
            duration=60,
            status="waiting",
            host_name="Ashwin Toppo",
            invite_link="/meeting/123456789001",
        ),
        Meeting(
            meeting_id="123456789002",
            title="Project Design Review",
            description="Review the new dashboard UI designs and gather feedback from the team",
            meeting_type="scheduled",
            scheduled_at=now + timedelta(days=1, hours=2),
            duration=45,
            status="waiting",
            host_name="Ashwin Toppo",
            invite_link="/meeting/123456789002",
        ),
        Meeting(
            meeting_id="123456789003",
            title="Client Presentation - Q4 Results",
            description="Present quarterly results, revenue metrics, and next quarter roadmap to the client",
            meeting_type="scheduled",
            scheduled_at=now + timedelta(days=2, hours=5),
            duration=90,
            status="waiting",
            host_name="Ashwin Toppo",
            invite_link="/meeting/123456789003",
        ),
        Meeting(
            meeting_id="123456789004",
            title="Engineering All-Hands",
            description="Monthly engineering department sync - tech debt review and hiring updates",
            meeting_type="scheduled",
            scheduled_at=now + timedelta(days=5, hours=1),
            duration=60,
            status="waiting",
            host_name="Ashwin Toppo",
            invite_link="/meeting/123456789004",
        ),
    ]

    # ── Recent ended meetings ────────────────────────────────────
    recent = [
        Meeting(
            meeting_id="987654321001",
            title="1:1 with Manager",
            description="Weekly one-on-one catch-up and performance discussion",
            meeting_type="instant",
            duration=30,
            status="ended",
            host_name="Ashwin Toppo",
            invite_link="/meeting/987654321001",
            created_at=now - timedelta(hours=5),
            updated_at=now - timedelta(hours=4, minutes=30),
        ),
        Meeting(
            meeting_id="987654321002",
            title="Code Review Session",
            description="Review pull requests for the authentication module and API refactor",
            meeting_type="scheduled",
            scheduled_at=now - timedelta(days=1),
            duration=45,
            status="ended",
            host_name="Ashwin Toppo",
            invite_link="/meeting/987654321002",
            created_at=now - timedelta(days=1, hours=2),
            updated_at=now - timedelta(days=1),
        ),
        Meeting(
            meeting_id="987654321003",
            title="Product Roadmap Discussion",
            description="Planning features and priorities for next quarter release cycle",
            meeting_type="scheduled",
            scheduled_at=now - timedelta(days=2),
            duration=60,
            status="ended",
            host_name="Ashwin Toppo",
            invite_link="/meeting/987654321003",
            created_at=now - timedelta(days=2, hours=3),
            updated_at=now - timedelta(days=2),
        ),
        Meeting(
            meeting_id="987654321004",
            title="Bug Triage Meeting",
            description="Prioritize and assign critical bugs from the latest release",
            meeting_type="instant",
            duration=25,
            status="ended",
            host_name="Ashwin Toppo",
            invite_link="/meeting/987654321004",
            created_at=now - timedelta(days=3),
            updated_at=now - timedelta(days=3),
        ),
        Meeting(
            meeting_id="987654321005",
            title="Design System Workshop",
            description="Hands-on workshop for the new component library and design tokens",
            meeting_type="scheduled",
            scheduled_at=now - timedelta(days=4),
            duration=120,
            status="ended",
            host_name="Ashwin Toppo",
            invite_link="/meeting/987654321005",
            created_at=now - timedelta(days=5),
            updated_at=now - timedelta(days=4),
        ),
    ]

    for meeting in upcoming + recent:
        db.add(meeting)

    sample_participants = [
        Participant(
            meeting_id="987654321001",
            display_name="Ashwin Toppo",
            role="host",
            is_audio_on=True,
            is_video_on=True,
            joined_at=now - timedelta(hours=5),
            left_at=now - timedelta(hours=4, minutes=30),
        ),
        Participant(
            meeting_id="987654321001",
            display_name="Alex Rivera",
            role="participant",
            is_audio_on=True,
            is_video_on=True,
            joined_at=now - timedelta(hours=5),
            left_at=now - timedelta(hours=4, minutes=30),
        ),
        Participant(
            meeting_id="987654321002",
            display_name="Ashwin Toppo",
            role="host",
            is_audio_on=True,
            is_video_on=True,
            joined_at=now - timedelta(days=1, hours=2),
            left_at=now - timedelta(days=1),
        ),
        Participant(
            meeting_id="987654321002",
            display_name="Sara Chen",
            role="participant",
            is_audio_on=True,
            is_video_on=False,
            joined_at=now - timedelta(days=1, hours=2),
            left_at=now - timedelta(days=1),
        ),
    ]

    for participant in sample_participants:
        db.add(participant)

    db.commit()
    db.close()
    print("[OK] Database seeded with sample meetings and participants")
