import type { Item } from '../common/records.js';

export interface ActivityRule {
  method: string;
  pattern: string;
  module: string;
  action: string;
}

/** Same allow-list as Laravel, with the `/api/v2` prefix the Nest app serves. */
export const ACTIVITY_RULES: ActivityRule[] = [
  {
    method: 'POST',
    pattern: 'v2/students/submissions',
    module: 'Submission',
    action: 'SUBMISSION_CREATE',
  },
  {
    method: 'PUT',
    pattern: 'v2/students/events/*/submissions/*',
    module: 'Submission',
    action: 'SUBMISSION_UPDATE',
  },
  {
    method: 'POST',
    pattern: 'v2/signatories/events/*/submissions/*/approve',
    module: 'Submission',
    action: 'SUBMISSION_APPROVE',
  },
  {
    method: 'POST',
    pattern: 'v2/signatories/events/*/submissions/*/return',
    module: 'Submission',
    action: 'SUBMISSION_RETURN',
  },
  {
    method: 'POST',
    pattern: 'v2/signatories/events/*/submissions/*/deny',
    module: 'Submission',
    action: 'SUBMISSION_DENY',
  },
  {
    method: 'PATCH',
    pattern: 'v2/signatories/events/*/submissions/*/classification',
    module: 'Submission',
    action: 'SUBMISSION_UPDATE',
  },
  {
    method: 'POST',
    pattern: 'v2/admins/announcements',
    module: 'Announcement',
    action: 'CREATE',
  },
  {
    method: 'PUT',
    pattern: 'v2/admins/announcements/*',
    module: 'Announcement',
    action: 'UPDATE',
  },
  {
    method: 'DELETE',
    pattern: 'v2/admins/announcements/*',
    module: 'Announcement',
    action: 'DELETE',
  },
  {
    method: 'POST',
    pattern: 'v2/admins/organizations',
    module: 'Organization',
    action: 'CREATE',
  },
  {
    method: 'PUT',
    pattern: 'v2/admins/organizations/*',
    module: 'Organization',
    action: 'UPDATE',
  },
  {
    method: 'POST',
    pattern: 'v2/admins/signatories',
    module: 'Signatory',
    action: 'CREATE',
  },
  {
    method: 'PUT',
    pattern: 'v2/admins/signatories/*',
    module: 'Signatory',
    action: 'UPDATE',
  },
];

const SECRET_KEYS = new Set([
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'cookie',
  'access_token',
  'id_token',
  'refresh_token',
  'client_secret',
  'api_key',
]);

export function matchActivity(
  method: string,
  path: string,
): ActivityRule | null {
  const normalized = path.replace(/^\/+/, '').replace(/^api\//, '');
  return (
    ACTIVITY_RULES.find(
      (rule) =>
        rule.method === method.toUpperCase() && like(rule.pattern, normalized),
    ) ?? null
  );
}

export function stripSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stripSecrets(entry));
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  const result: Item = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_KEYS.has(key.toLowerCase())) {
      continue;
    }
    result[key] = stripSecrets(entry);
  }
  return result;
}

function like(pattern: string, path: string): boolean {
  const expression = `^${pattern.split('*').map(escape).join('[^/]+')}$`;
  return new RegExp(expression).test(path);
}

function escape(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}
