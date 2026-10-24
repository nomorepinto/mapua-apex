const PREFIX = /^[A-Za-z]{1,10}$/;

export function normalizePrefixes(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen = new Set<string>();
  const prefixes: string[] = [];
  for (const value of input) {
    if (typeof value !== 'string') {
      continue;
    }
    const token = value.trim().toUpperCase();
    if (token === '' || seen.has(token)) {
      continue;
    }
    seen.add(token);
    prefixes.push(token);
  }
  return prefixes;
}

export function hasFormat(prefixes: string[], digits: number | null): boolean {
  return prefixes.length > 0 && digits !== null && Number.isFinite(digits);
}

export function matchesClassroom(
  prefixes: string[],
  digits: number | null,
  name: string,
): boolean {
  if (!hasFormat(prefixes, digits) || digits === null || digits < 1) {
    return false;
  }
  const trimmed = name.trim();
  return prefixes.some((prefix) =>
    new RegExp(`^${escapeRegExp(prefix)}\\d{${digits}}$`, 'i').test(trimmed),
  );
}

export function classroomHint(
  prefixes: string[],
  digits: number | null,
): string | null {
  if (!hasFormat(prefixes, digits) || digits === null) {
    return null;
  }
  return `${prefixes.join(' / ')} followed by exactly ${digits} digits`;
}

export function isPrefixToken(value: string): boolean {
  return PREFIX.test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
