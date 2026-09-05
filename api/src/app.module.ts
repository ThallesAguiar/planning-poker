import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { RoomController } from './room.controller.js';
import { RoomGateway } from './room.gateway.js';
import { RoomService } from './room.service.js';
import { PrismaService } from './prisma.service.js';
import { AuthorizationService } from './auth/authorization.service.js';
import { SessionService } from './auth/session.service.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { TimerService } from './realtime/timer.service.js';
import { ReportController } from './reports/report.controller.js';
import { ReportService } from './reports/report.service.js';
import { AchievementsService } from './reports/achievements.service.js';
import { InsightsService } from './reports/insights.service.js';
import { PdfExportService } from './reports/pdf-export.service.js';
import { LlmClient } from './ai/llm.client.js';
import { AiParticipantService } from './ai/ai-participant.service.js';
import { RoomStateService } from './realtime/room-state.service.js';
import { RoundService } from './realtime/round.service.js';
import { PresenceService } from './realtime/presence.service.js';
import { CorrelationLogger } from './realtime/logger.service.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'api',
    }),
  ],
  controllers: [AppController, AuthController, RoomController, ReportController],
  providers: [AppService, PrismaService, AuthService, RoomService, RoomGateway, AuthorizationService, SessionService, TimerService, ReportService, AchievementsService, InsightsService, PdfExportService, LlmClient, AiParticipantService, RoomStateService, RoundService, PresenceService, CorrelationLogger],
})
export class AppModule {}
