/**
 * API client for Zoom Clone backend REST endpoints.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

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
  host_user_id?: number | null;
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
}

export interface JoinMeetingPayload {
  display_name: string;
  is_audio_on?: boolean;
  is_video_on?: boolean;
  reconnect_participant_id?: number | null;  // For page-refresh reconnects
}

// â”€â”€â”€ Core Request Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function request<T>(
  endpoint: string,
  options?: RequestInit,
  token?: string | null
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      let errorMessage = `HTTP error ${res.status}`;
      try {
        const errorData = await res.json();
        if (errorData.detail) {
          errorMessage =
            typeof errorData.detail === "string"
              ? errorData.detail
              : JSON.stringify(errorData.detail);
        }
      } catch {
        errorMessage = res.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return await res.json();
  } catch (err: unknown) {
    if (err instanceof Error) throw err;
    throw new Error("Unable to connect to server. Please check your backend.");
  }
}

// â”€â”€â”€ Auth API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function signupUser(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<TokenResponse> {
  return request<TokenResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<TokenResponse> {
  return request<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/me", {}, token);
}

// â”€â”€â”€ Meeting API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Create a new instant meeting (requires auth token) */
export async function createInstantMeeting(
  token: string,
  title?: string
): Promise<Meeting> {
  return request<Meeting>(
    "/api/meetings/instant",
    { method: "POST", body: JSON.stringify({ title }) },
    token
  );
}

/** Create a scheduled meeting (requires auth token) */
export async function createScheduledMeeting(
  token: string,
  payload: CreateScheduledMeetingPayload
): Promise<Meeting> {
  return request<Meeting>(
    "/api/meetings/schedule",
    { method: "POST", body: JSON.stringify(payload) },
    token
  );
}

/** Retrieve all upcoming meetings (requires auth token) */
export async function getUpcomingMeetings(token: string): Promise<MeetingListResponse> {
  return request<MeetingListResponse>(
    "/api/meetings/upcoming",
    { method: "GET", cache: "no-store" },
    token
  );
}

/** Retrieve recently ended meetings (requires auth token) */
export async function getRecentMeetings(token: string): Promise<MeetingListResponse> {
  return request<MeetingListResponse>(
    "/api/meetings/recent",
    { method: "GET", cache: "no-store" },
    token
  );
}

/** Retrieve meeting details by meeting ID â€” public, no auth required */
export async function getMeetingById(meetingId: string): Promise<Meeting> {
  return request<Meeting>(`/api/meetings/${encodeURIComponent(meetingId)}`, {
    method: "GET",
    cache: "no-store",
  });
}

/** Join meeting â€” no auth required (guest flow) */
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
      reconnect_participant_id: payload.reconnect_participant_id ?? null,
    }),
  });
}

/** Leave a meeting â€” no auth required */
export async function leaveMeeting(
  meetingId: string,
  participantId: number
): Promise<{ message: string }> {
  return request<{ message: string }>(
    `/api/meetings/${encodeURIComponent(meetingId)}/leave?participant_id=${participantId}`,
    { method: "POST" }
  );
}

/** Update participant audio/video states â€” no auth required (self-service) */
export async function updateParticipantMedia(
  meetingId: string,
  participantId: number,
  payload: { is_audio_on?: boolean; is_video_on?: boolean }
): Promise<Participant> {
  return request<Participant>(
    `/api/meetings/${encodeURIComponent(meetingId)}/participants/${participantId}/media`,
    { method: "PATCH", body: JSON.stringify(payload) }
  );
}

/** Mute all participants (host control) â€” requires auth token */
export async function muteAllParticipants(
  meetingId: string,
  requesterParticipantId: number,
  token: string
): Promise<Participant[]> {
  return request<Participant[]>(
    `/api/meetings/${encodeURIComponent(meetingId)}/mute-all?requester_id=${requesterParticipantId}`,
    { method: "POST" },
    token
  );
}

/** Remove participant from meeting (host control) â€” requires auth token */
export async function removeParticipant(
  meetingId: string,
  participantId: number,
  requesterParticipantId: number,
  token: string
): Promise<{ message: string }> {
  return request<{ message: string }>(
    `/api/meetings/${encodeURIComponent(meetingId)}/participants/${participantId}?requester_id=${requesterParticipantId}`,
    { method: "DELETE" },
    token
  );
}

/** End meeting for all participants (host only) â€” requires auth token */
export async function endMeeting(
  meetingId: string,
  requesterParticipantId: number,
  token: string
): Promise<Meeting> {
  return request<Meeting>(
    `/api/meetings/${encodeURIComponent(meetingId)}/end?requester_id=${requesterParticipantId}`,
    { method: "PUT" },
    token
  );
}

/** Get all active participants in a meeting â€” public */
export async function getParticipants(meetingId: string): Promise<Participant[]> {
  return request<Participant[]>(
    `/api/meetings/${encodeURIComponent(meetingId)}/participants`,
    { method: "GET", cache: "no-store" }
  );
}


/** Heartbeat — updates last_seen for presence tracking. Fire-and-forget. */
export function sendHeartbeat(meetingId: string, participantId: number): void {
  const url = `${API_BASE_URL}/api/meetings/${encodeURIComponent(meetingId)}/heartbeat?participant_id=${participantId}`;
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(url);
  } else {
    fetch(url, { method: "POST" }).catch(() => {});
  }
}

/** Reliably notify the backend the participant left (use during page unload). */
export function sendBeaconLeave(meetingId: string, participantId: number): void {
  const url = `${API_BASE_URL}/api/meetings/${encodeURIComponent(meetingId)}/leave?participant_id=${participantId}`;
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(url);
  }
}
