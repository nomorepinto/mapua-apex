import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { SESClient } from '@aws-sdk/client-ses';
import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module.js';
import { AppConfigService } from '../config/app-config.service.js';
import { DynamoAdapter } from './dynamo.adapter.js';
import { DynamoTable } from './dynamo-table.js';
import { COGNITO_IDP, DYNAMO, SES_CLIENT } from './dynamo.port.js';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [
    DynamoAdapter,
    { provide: DYNAMO, useExisting: DynamoAdapter },
    DynamoTable,
    {
      provide: SES_CLIENT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): SESClient =>
        new SESClient(
          config.clientOptions(config.sesRegion(), config.endpoint()),
        ),
    },
    {
      provide: COGNITO_IDP,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): CognitoIdentityProviderClient =>
        new CognitoIdentityProviderClient(
          config.clientOptions(
            config.cognitoRegion(),
            config.cognitoEndpoint(),
          ),
        ),
    },
  ],
  exports: [DYNAMO, DynamoTable, SES_CLIENT, COGNITO_IDP],
})
export class AwsModule {}
