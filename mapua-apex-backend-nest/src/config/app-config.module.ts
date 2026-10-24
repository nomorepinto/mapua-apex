import { Global, Module } from '@nestjs/common';
import { TtlCache } from '../common/ttl-cache.js';
import { AppConfigService } from './app-config.service.js';

@Global()
@Module({
  providers: [AppConfigService, TtlCache],
  exports: [AppConfigService, TtlCache],
})
export class AppConfigModule {}
