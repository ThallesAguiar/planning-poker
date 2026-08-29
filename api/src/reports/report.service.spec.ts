import { beforeEach, describe, expect, it } from 'vitest';
import { AuthorizationService } from '../auth/authorization.service.js';
import { SessionService } from '../auth/session.service.js';
import { ReportService } from './report.service.js';
import { AchievementsService } from './achievements.service.js';
import { PdfExportService } from './pdf-export.service.js';

describe('ReportService', () => {
  const session = new SessionService();
  const prisma: any = { room: { findUnique: async () => undefined, update: async () => undefined }, sprintReport: { findFirst: async () => undefined, create: async ({ data }: any) => ({ id: 'report-1', ...data }), findMany: async () => [], findUnique: async () => undefined }, roomParticipant: { findFirst: async () => undefined } };
  const service = new ReportService(prisma, new AuthorizationService(), session, new AchievementsService(), new PdfExportService());

  beforeEach(() => {
    prisma.room.findUnique = async () => ({ id: 'room-1', stories: [{ id: 'story-1', title: 'Login', description: '', order: 1, status: 'estimada', finalValue: '5', criterion: 'decisao_po', rounds: 1, totalSeconds: 12, voteRounds: [{ number: 1, startedAt: new Date(), endedAt: new Date(), votes: [{ participantId: 'participant-1' }] }] }], messages: [{ participantId: 'participant-1' }], participants: [{ id: 'participant-1' }] });
    prisma.roomParticipant.findFirst = async () => ({ id: 'participant-1', roomId: 'room-1', role: 'PO', status: 'ativo' });
  });

  it('normalizes story and participation facts into a durable report', async () => {
    const report = await service.generate('room-1');
    expect((report.summary as any).stories[0]).toMatchObject({ title: 'Login', finalValue: '5', rounds: 1, divergenceInitial: null, divergenceFinal: null });
    expect((report.summary as any).participation[0]).toEqual({ participantId: 'participant-1', votes: 1, comments: 1 });
  });

  it('allows CSV export only with a valid room session', async () => {
    const token = session.issueGuest('room-1', 'participant-1', 'guest-1').token;
    prisma.sprintReport.findUnique = async () => ({ id: 'report-1', roomId: 'room-1', summary: { stories: [{ title: 'Login', status: 'estimada', finalValue: '5', rounds: 1, totalSeconds: 12, criterion: 'decisao_po' }] } });
    const csv = await service.exportCsv('report-1', token);
    expect(csv).toContain('"Historia","Status","Valor final"');
    expect(csv).toContain('"Login","estimada","5"');
  });

  it('renders PDF export only with a valid room session', async () => {
    const token = session.issueGuest('room-1', 'participant-1', 'guest-1').token;
    prisma.sprintReport.findUnique = async () => ({ id: 'report-1', roomId: 'room-1', summary: { stories: [{ title: 'Login', status: 'estimada', finalValue: '5', rounds: 1 }] } });
    const pdf = await service.exportPdf('report-1', token);
    expect(pdf.subarray(0, 8).toString()).toBe('%PDF-1.4');
  });
});
