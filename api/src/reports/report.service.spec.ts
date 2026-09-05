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
  const startedAt = new Date('2026-09-04T10:00:00Z');
  const endedAt = new Date('2026-09-04T10:02:00Z');

  beforeEach(() => {
    prisma.room.findUnique = async () => ({
      id: 'room-1',
      name: 'Sprint 32',
      inviteCode: 'SPRINT',
      stories: [{
        id: 'story-1', title: 'Login', description: '', order: 1, status: 'estimada', finalValue: '5', criterion: 'unanime', rounds: 1, totalSeconds: 0,
        voteRounds: [{ number: 1, startedAt, endedAt, timerType: null, timerDeadline: null, votes: [{ participantId: 'participant-1', value: '5' }, { participantId: 'participant-2', value: '5' }] }],
      }],
      messages: [{ id: 'm1', storyId: 'story-1', participantId: 'participant-1', text: 'fechou no 5', type: 'justificativa', createdAt: endedAt }],
      participants: [
        { id: 'participant-1', roomDisplayName: 'Maria', role: 'PO', user: { name: 'Maria Andrade' } },
        { id: 'participant-2', roomDisplayName: null, role: 'Dev', user: { name: 'João' } },
      ],
    });
    prisma.roomParticipant.findFirst = async () => ({ id: 'participant-1', roomId: 'room-1', role: 'PO', status: 'ativo' });
  });

  it('normalizes story, participation and identity facts into a durable report', async () => {
    const report = await service.generate('room-1');
    const summary = (report.summary as any);
    expect(summary.roomName).toBe('Sprint 32');
    expect(summary.roomCode).toBe('SPRINT');
    expect(summary.stories[0]).toMatchObject({ title: 'Login', finalValue: '5', rounds: 1, divergenceInitial: { min: 5, max: 5, spread: 0 }, divergenceFinal: { min: 5, max: 5, spread: 0 } });
    expect(summary.stories[0].totalSeconds).toBe(120);
    expect(summary.stories[0].roundsDetail[0]).toMatchObject({ number: 1, votes: 2, durationSeconds: 120 });
    expect(summary.stories[0].comments).toEqual([{ id: 'm1', author: 'Maria', role: 'PO', text: 'fechou no 5', type: 'justificativa', createdAt: endedAt.toISOString() }]);
    expect(summary.participation).toEqual([
      { participantId: 'participant-1', name: 'Maria', votes: 1, comments: 1 },
      { participantId: 'participant-2', name: 'João', votes: 1, comments: 0 },
    ]);
    expect(summary.achievements).toContain('consenso-unanime');
  });

  it('derives totalSeconds as the sum of round durations when endedAt is missing', async () => {
    prisma.room.findUnique = async () => ({
      id: 'room-1', name: 'Sprint 32', inviteCode: 'SPRINT',
      stories: [{ id: 'story-1', title: 'Login', description: '', order: 1, status: 'estimada', finalValue: '3', criterion: 'media', rounds: 2, totalSeconds: 0, voteRounds: [
        { number: 1, startedAt: new Date('2026-09-04T10:00:00Z'), endedAt: new Date('2026-09-04T10:01:30Z'), timerType: null, timerDeadline: null, votes: [] },
        { number: 2, startedAt: new Date('2026-09-04T10:05:00Z'), endedAt: null, timerType: 'reflexao', timerDeadline: new Date('2026-09-04T10:06:45Z'), votes: [] },
      ] }],
      messages: [],
      participants: [],
    });
    const summary = (await service.generate('room-1').then((r: any) => r.summary)) as any;
    expect(summary.stories[0].totalSeconds).toBe(90 + 105);
    expect(summary.stories[0].roundsDetail[1].timerType).toBe('reflexao');
    expect(summary.stories[0].roundsDetail[1].durationSeconds).toBe(105);
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