import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { AppConfigService } from './app-config.service.js';

function service(values: Record<string, string>): AppConfigService {
  const config = {
    get: (key: string) => values[key],
  } as ConfigService;
  return new AppConfigService(config);
}

describe('AppConfigService.clientOptions', () => {
  it('passes long-lived local keys to the AWS client', () => {
    const options = service({
      AWS_ACCESS_KEY_ID: 'local-key',
      AWS_SECRET_ACCESS_KEY: 'local-secret',
    }).clientOptions('ap-southeast-1');

    expect(options.credentials).toEqual({
      accessKeyId: 'local-key',
      secretAccessKey: 'local-secret',
    });
  });

  it('leaves Lambda temporary credentials to the SDK default chain', () => {
    const options = service({
      AWS_ACCESS_KEY_ID: 'ASIAEXAMPLE',
      AWS_SECRET_ACCESS_KEY: 'temporary-secret',
      AWS_SESSION_TOKEN: 'session-token',
    }).clientOptions('ap-southeast-1');

    expect(options.credentials).toBeUndefined();
    expect(options.region).toBe('ap-southeast-1');
  });
});
