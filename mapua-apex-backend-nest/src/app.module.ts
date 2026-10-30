import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccountsModule } from './accounts/accounts.module.js';
import { ActivityModule } from './activity/activity.module.js';
import { ApprovalSettingsModule } from './approval-settings/approval-settings.module.js';
import { AnnouncementsModule } from './announcements/announcements.module.js';
import { ArcusModule } from './arcus/arcus.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AwsModule } from './aws/aws.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { CampusesModule } from './campuses/campuses.module.js';
import { AppConfigModule } from './config/app-config.module.js';
import { existingRootEnv } from './config/root-env.js';
import { DeadlinesModule } from './deadlines/deadlines.module.js';
import { HealthModule } from './health/health.module.js';
import { InputChecksModule } from './input-checks/input-checks.module.js';
import { MembersModule } from './members/members.module.js';
import { MonitorModule } from './monitor/monitor.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { PostEvalsModule } from './postevals/postevals.module.js';
import { ReservationChangesModule } from './reservation-changes/reservation-changes.module.js';
import { ReservablesModule } from './reservables/reservables.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { SignatoriesModule } from './signatories/signatories.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';

const envFile = existingRootEnv();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ...(envFile ? { envFilePath: envFile } : {}),
    }),
    AppConfigModule,
    AwsModule,
    AuthModule,
    HealthModule,
    AnnouncementsModule,
    AccountsModule,
    OrganizationsModule,
    SignatoriesModule,
    ApprovalSettingsModule,
    MembersModule,
    CampusesModule,
    ReservablesModule,
    BookingsModule,
    SubmissionsModule,
    DeadlinesModule,
    InputChecksModule,
    PostEvalsModule,
    ReservationChangesModule,
    ArcusModule,
    SessionsModule,
    ActivityModule,
    MonitorModule,
  ],
})
export class AppModule {}
