export interface ActiveSessionPointer {
  session_id: string;
  last_heartbeat?: string | null;
}

export interface SessionRecord {
  end_reason?: string | null;
  status?: string | null;
}

export interface SessionReader {
  getActiveSessionPointer(sub: string): Promise<ActiveSessionPointer | null>;
  getSessionItem(sessionId: string): Promise<SessionRecord | null>;
}

export const SESSION_READER = Symbol('SESSION_READER');
