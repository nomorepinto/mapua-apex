/** Key builders matching Laravel `DynamoKeys`. Stored keys keep their prefix. */

export function stripPrefix(value: unknown, prefix: string): string | null {
  if (typeof value !== 'string' || value === '') {
    return null;
  }
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

export function organizationKey(id: string): string {
  return `ORGANIZATION#${stripPrefix(id, 'ORGANIZATION#')}`;
}

export function eventKey(id: string): string {
  return `EVENT#${stripPrefix(id, 'EVENT#')}`;
}

export function submissionKey(id: string): string {
  return `SUBMISSION#${stripPrefix(id, 'SUBMISSION#')}`;
}

export function postEvalKey(id: string): string {
  return `POSTEVAL#${stripPrefix(id, 'POSTEVAL#')}`;
}

export function memberKey(studentId: string): string {
  return `MEMBER#${stripPrefix(studentId, 'MEMBER#')}`;
}

export function studentKey(studentId: string): string {
  return `STUDENT#${stripPrefix(studentId, 'STUDENT#')}`;
}

export function signatoryKey(id: string): string {
  return `SIGNATORY#${stripPrefix(id, 'SIGNATORY#')}`;
}

export function notificationKey(timestamp: string): string {
  return timestamp.startsWith('NOTIFICATION#')
    ? timestamp
    : `NOTIFICATION#${timestamp}`;
}

export function deadlineKey(id: string): string {
  return `DEADLINE#${stripPrefix(id, 'DEADLINE#')}`;
}

export function campusKey(id: string): string {
  return `CAMPUS#${stripPrefix(id, 'CAMPUS#')}`;
}

export function reservableKey(id: string): string {
  return `RESERVABLE#${stripPrefix(id, 'RESERVABLE#')}`;
}

export function bookingKey(id: string): string {
  return `BOOKING#${stripPrefix(id, 'BOOKING#')}`;
}

export function reservationChangeKey(id: string): string {
  return `RESERVATION_CHANGE#${stripPrefix(id, 'RESERVATION_CHANGE#')}`;
}

export function collaborationKey(
  eventId: string,
  submissionId: string,
): string {
  const event = stripPrefix(eventId, 'EVENT#');
  const submission = stripPrefix(submissionId, 'SUBMISSION#');
  return `COLLAB#${event}#${submission}`;
}

export function announcementPk(): string {
  return 'ANNOUNCEMENT';
}

export function sessionKey(sessionId: string): string {
  return `SESSION#${stripPrefix(sessionId, 'SESSION#')}`;
}

export function sessionGsi1(yearMonth: string): string {
  return `LOG#SESSION#${yearMonth}`;
}

export function userKey(sub: string): string {
  return `USER#${stripPrefix(sub, 'USER#')}`;
}

export function activeSessionSk(): string {
  return 'ACTIVE_SESSION';
}

export function roleIndex(role: string, department?: string | null): string {
  const upper = role.toUpperCase();
  const key = `ROLE#${upper}`;
  if (role.toLowerCase() !== 'dean') {
    return key;
  }
  const dept = (department ?? '').trim().toUpperCase();
  return dept === '' ? key : `${key}#${dept}`;
}

/** UTC timestamp at second precision, matching Laravel `DynamoKeys::now()`. */
export function nowIso(date: Date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function bareId(value: unknown, prefix: string): string | null {
  return stripPrefix(value, prefix);
}
