import type { Request } from 'express';

/**
 * Prefer CloudFront's viewer address, then the first forwarded hop.
 * `::1` is rewritten the same way Laravel's session writer rewrites it.
 */
export function clientIp(request: Request): string {
  const viewer = header(request, 'cloudfront-viewer-address');
  if (viewer) {
    return normalize(stripPort(viewer));
  }
  const forwarded = header(request, 'x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) {
      return normalize(first);
    }
  }
  const real = header(request, 'x-real-ip');
  if (real) {
    return normalize(real);
  }
  return normalize(request.ip ?? 'unknown');
}

function header(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function stripPort(value: string): string {
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    return end === -1 ? value : value.slice(1, end);
  }
  const colon = value.lastIndexOf(':');
  if (colon > -1 && value.indexOf(':') === colon) {
    return value.slice(0, colon);
  }
  return value;
}

function normalize(ip: string): string {
  return ip === '::1' ? '127.0.0.1' : ip;
}
