/**
 * API client for Zoom Clone backend REST endpoints.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Participant {
  id: number;
  meeting_id: string;
  display_name: string;
  role: "host" | "participant";
  is_audio_on: boolean;
  is_video_on: boolean;
  joined_at: string;
  left_at?: string | null;
}

export interface Meeting {
  id: number;
  meeting_id: string;
  title: string;
  description?: string | null;
  meeting_type: "instant" | "scheduled";
  scheduled_at?: string | null;
  duration: number;
  invite_link?: string | null;
  status: "waiting" | "active" | "ended";
  host_name: string;
  created_at: string;
  updated_at: string;
  participant_count: number;
  participants: Participant[];
}

export interface MeetingListResponse {
  meetings: Meeting[];
  total: number;
}

export interface CreateScheduledMeetingPayload {
  title: string;
  description?: string;
  scheduled_at: string;
  duration: number;
  host_name?: string;
}

export interface JoinMeetingPayload {
  display_name: string;
  is_audio_on?: boolean;
  is_video_on?: boolean;
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      let errorMessage = `HTTP error ${res.status}`;
      try {
        const errorData = await res.json();
        if (errorData.detail) {
          errorMessage = typeof errorData.detail === "string" 
            ? errorData.detail 
            : JSON.stringify(errorData.detail);
        }
      } catch {
        // Fall back to default status text
        errorMessage = res.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return await res.json();
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("Unable to connect to server. Please check your backend.");
  }
}

/** Create a new instant meeting */
export async function createInstantMeeting(
  title?: string,
  host_name: string = "Ashwin Toppo"
): Promise<Meeting> {
  return request<Meeting>("/api/meetings/instant", {
    method: "POST",
    body: JSON.stringify({ title, host_name }),
  });
}

/** Create a scheduled meeting */
export async function createScheduledMeeting(
  payload: CreateScheduledMeetingPayload
): Promise<Meeting> {
  return request<Meeting>("/api/meetings/schedule", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Retrieve all upcoming meetings */
export async function getUpcomingMeetings(): Promise<MeetingListResponse> {
  return request<MeetingListResponse>("/api/meetings/upcoming", {
    method: "GET",
    cache: "no-store",
  });
}

/** Retrieve recently ended meetings */
export async function getRecentMeetings(): Promise<MeetingListResponse> {
  return request<MeetingListResponse>("/api/meetings/recent", {
    method: "GET",
    cache: "no-store",
  });
}

/** Retrieve meeting details by 12-char Meeting ID (validates existence) */
export async function getMeetingById(meetingId: string): Promise<Meeting> {
  return request<Meeting>(`/api/meetings/${encodeURIComponent(meetingId)}`, {
    method: "GET",
    cache: "no-store",
  });
}

/** Join meeting with display name */
export async function joinMeeting(
  meetingId: string,
  payload: JoinMeetingPayload
): Promise<Participant> {
  return request<Participant>(`/api/meetings/${encodeURIComponent(meetingId)}/join`, {
    method: "POST",
    body: JSON.stringify({
      display_name: payload.display_name,
      is_audio_on: payload.is_audio_on ?? true,
      is_video_on: payload.is_video_on ?? true,
    }),
  });
}
