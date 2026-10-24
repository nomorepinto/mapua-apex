import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import { TtlCache } from '../common/ttl-cache.js';
import { abort } from '../common/http.js';
import { record } from '../common/records.js';

const ALLOWED_DOMAINS = ['mymail.mapua.edu.ph', 'mapua.edu.ph', 'gmail.com'];
const DAY_SECONDS = 24 * 60 * 60;

export interface EmailCheck {
  state: 'valid' | 'invalid' | 'domain_not_allowed' | 'unavailable';
  score?: number;
  did_you_mean?: string | null;
  cached: boolean;
}

export interface GibberishCheck {
  is_gibberish: boolean;
  cached: boolean;
}

@Injectable()
export class InputCheckService {
  private readonly logger = new Logger(InputCheckService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly cache: TtlCache,
  ) {}

  async validateEmail(raw: string | undefined): Promise<EmailCheck> {
    if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) || raw.length > 254) {
      abort(422, 'The email field must be a valid email address.');
    }
    const email = raw.trim().toLowerCase();
    const domain = email.slice(email.lastIndexOf('@') + 1);
    if (!ALLOWED_DOMAINS.includes(domain)) {
      return { state: 'domain_not_allowed', cached: false };
    }
    const apiKey = this.config.emailDetectiveApiKey();
    if (apiKey === '') {
      return { state: 'unavailable', cached: false };
    }
    const key = `emailcheck:${createHash('sha1').update(email).digest('hex')}`;
    const cached = this.cache.get<Omit<EmailCheck, 'cached'>>(key);
    if (cached) {
      return { ...cached, cached: true };
    }
    const result = await this.lookupEmail(email, apiKey);
    if (result.state !== 'unavailable') {
      this.cache.set(key, result, DAY_SECONDS);
    }
    return { ...result, cached: false };
  }

  async detectGibberish(text: string | undefined): Promise<GibberishCheck> {
    if (!this.config.gibberishEnabled()) {
      return { is_gibberish: false, cached: false };
    }
    if (text === undefined || text === null) {
      abort(422, 'The text field is required.');
    }
    if (typeof text !== 'string' || text.length > 20000) {
      abort(422, 'The text field is required.');
    }
    const trimmed = text.trim();
    if (trimmed === '') {
      return { is_gibberish: false, cached: false };
    }
    const apiKey = this.config.gibberishApiKey();
    if (apiKey === '') {
      return { is_gibberish: false, cached: false };
    }
    const key = `gibberish:${this.config.gibberishVersion()}:${createHash('sha1').update(trimmed).digest('hex')}`;
    const cached = this.cache.get<boolean>(key);
    if (cached !== undefined) {
      return { is_gibberish: cached, cached: true };
    }
    const verdict = await this.lookupGibberish(trimmed, apiKey);
    if (verdict === null) {
      return { is_gibberish: false, cached: false };
    }
    const ttl = Math.max(60, this.config.gibberishCacheTtlSeconds());
    this.cache.set(key, verdict, ttl);
    return { is_gibberish: verdict, cached: false };
  }

  private async lookupEmail(
    email: string,
    apiKey: string,
  ): Promise<Omit<EmailCheck, 'cached'>> {
    const base = this.config.emailDetectiveBaseUrl().replace(/\/$/, '');
    try {
      const response = await fetch(
        `${base}/emails/${encodeURIComponent(email)}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!response.ok) {
        return { state: 'unavailable' };
      }
      const payload = record(await response.json());
      if (!payload) {
        return { state: 'unavailable' };
      }
      const suggestion =
        typeof payload.did_you_mean === 'string' ? payload.did_you_mean : '';
      return {
        state: payload.valid_email === true ? 'valid' : 'invalid',
        score: typeof payload.score === 'number' ? payload.score : 0,
        did_you_mean:
          suggestion !== '' && suggestion.toLowerCase() !== email
            ? suggestion
            : null,
      };
    } catch (error) {
      this.logger.warn(
        `Email check failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return { state: 'unavailable' };
    }
  }

  private async lookupGibberish(
    text: string,
    apiKey: string,
  ): Promise<boolean | null> {
    const base = this.config.gibberishBaseUrl().replace(/\/$/, '');
    if (base === '') {
      return null;
    }
    try {
      const response = await fetch(`${base}/api/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        this.logger.warn(
          `Gibberish detector returned status ${response.status}.`,
        );
        return null;
      }
      const payload = record(await response.json());
      if (!payload || !('is_gibberish' in payload)) {
        this.logger.warn('Gibberish detector response was not parsable.');
        return null;
      }
      return payload.is_gibberish === true;
    } catch (error) {
      this.logger.warn(
        `Gibberish detector request failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return null;
    }
  }
}
