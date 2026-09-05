import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthorizationService } from '../auth/authorization.service.js';
import { SessionService } from '../auth/session.service.js';
import { ReportService } from './report.service.js';
import { AchievementsService } from './achievements.service.js';
import { PdfExportService } from './pdf-export.service.js';
import { InsightsService } from './insights.service.js';

describe('ReportService', () => {
  const session = new SessionService();
  const prisma: any = { room: { findUnique: async () => undefined, update: async () => undefined }, sprintReport: { findFirst: async () => undefined, create: async ({ data }: any) => ({ id: 'report-1', ...data }), delete: async () => undefined, findMany: async () => [], findUnique: async () => undefined }, roomParticipant: { findFirst: async () => undefined } };
  const service = new ReportService(prisma, new AuthorizationService(), session, new AchievementsService(), new PdfExportService(), new InsightsService({} as any));
  const startedAt = new Date('2026-09-04T10:00:00Z');
  const endedAt = new Date('2026-09-04T10:02:00Z');

  beforeEach(() => {
    prisma.room.findUnique = async () => ({
      id: 'room-1',
      name: 'Sprint 32',
      inviteCode: 'SPRINT',
      stories: [{
        id: 'story-1', title: 'Login', description: '', order: 1, status: 'estimada', finalValue: '5', criterion: 'unanime', rounds: 1, totalSeconds: 0,
        voteRounds: [{ number: 1, startedAt, endedAt, timerType: null, timerDeadline: null, votes: [{ participantId: 'participant-1', value: '5', revealed: true, justification: 'simples' }, { participantId: 'participant-2', value: '5', revealed: true, justification: null }] }],
      }],
      messages: [
        { id: 'm1', storyId: 'story-1', participantId: 'participant-1', text: 'fechou no 5', type: 'justificativa', createdAt: endedAt },
        { id: 'm2', storyId: null, participantId: 'participant-1', text: 'vamos comecar a reuniao', type: 'chat', createdAt: startedAt },
      ],
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
    expect(summary.stories[0].roundsDetail[0].voteDetails).toEqual([
      { participantName: 'Maria', value: '5', justification: 'simples' },
      { participantName: 'João', value: '5', justification: null },
    ]);
    expect(summary.stories[0].comments).toEqual([{ id: 'm1', author: 'Maria', role: 'PO', text: 'fechou no 5', type: 'justificativa', createdAt: endedAt.toISOString() }]);
    expect(summary.roomNotes).toEqual([{ id: 'm2', author: 'Maria', role: 'PO', text: 'vamos comecar a reuniao', type: 'chat', createdAt: startedAt.toISOString() }]);
    expect(summary.insights).toBeDefined();
    expect(Array.isArray(summary.insights.perStory)).toBe(true);
    expect(summary.insights.perStory[0].storyId).toBe('story-1');
    expect(summary.participation).toEqual([
      { participantId: 'participant-1', name: 'Maria', votes: 1, comments: 2 },
      { participantId: 'participant-2', name: 'João', votes: 1, comments: 0 },
    ]);
    expect(summary.achievements).toContain('consenso-unanime');
  });

  it('anonymizes vote identities and omits room notes/chat when configured', async () => {
    prisma.room.findUnique = async () => ({
      id: 'room-1', name: 'Sprint 32', inviteCode: 'SPRINT', config: { votoAnonimo: true },
      stories: [{
        id: 'story-1', title: 'Login', description: '', order: 1, status: 'estimada', finalValue: '5', criterion: 'unanime', rounds: 1, totalSeconds: 0,
        voteRounds: [{ number: 1, startedAt, endedAt, timerType: null, timerDeadline: null, votes: [{ participantId: 'participant-1', value: '5', revealed: true, justification: 'simples' }] }],
      }],
      messages: [
        { id: 'm1', storyId: 'story-1', participantId: 'participant-1', text: 'na historia', type: 'chat', createdAt: endedAt },
        { id: 'm2', storyId: null, participantId: 'participant-2', text: 'da mesa', type: 'chat', createdAt: startedAt },
      ],
      participants: [
        { id: 'participant-1', roomDisplayName: 'Maria', role: 'PO', user: { name: 'Maria Andrade' } },
        { id: 'participant-2', roomDisplayName: null, role: 'Dev', user: { name: 'João' } },
      ],
    });
    const summary = (await service.generate('room-1', { withChat: false, withVotes: true, withRoomNotes: false, withInsights: false } as any).then((r: any) => r.summary)) as any;
    expect(summary.stories[0].roundsDetail[0].voteDetails[0].participantName).toBe('Participante');
    expect(summary.stories[0].comments).toEqual([]);
    expect(summary.roomNotes).toEqual([]);
    expect(summary.insights).toBeUndefined();
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

  it('regenerating a room report replaces the previous one instead of returning it as-is', async () => {
    prisma.sprintReport.findFirst = async () => ({ id: 'stale-report', roomId: 'room-1', summary: { stories: [] } });
    prisma.sprintReport.delete = vi.fn(async () => undefined);
    prisma.room.findUnique = async () => ({
      id: 'room-1', name: 'Sprint 32', inviteCode: 'SPRINT',
      stories: [], messages: [], participants: [],
    });
    const report = await service.generate('room-1');
    expect(prisma.sprintReport.delete).toHaveBeenCalledWith({ where: { id: 'stale-report' } });
    expect(report).toMatchObject({ roomId: 'room-1' });
  });

  it('allows CSV export only with a valid room session', async () => {
    const token = session.issueGuest('room-1', 'participant-1', 'guest-1').token;
    prisma.sprintReport.findUnique = async () => ({
      id: 'report-1',
      roomId: 'room-1',
      summary: {
        roomName: 'Sprint 32',
        roomCode: 'SPRINT',
        generatedAt: '2026-09-05T10:00:00.000Z',
        stories: [{ id: 'story-1', title: 'Login', status: 'estimada', finalValue: '5', rounds: 1, totalSeconds: 12, criterion: 'decisao_po' }],
        insights: { overall: { summary: 'resumo geral da sessao', suggestedTasks: ['task resumo'] } },
        participation: [{ participantId: 'participant-1', name: 'Maria', votes: 1, comments: 2 }],
        achievements: ['consenso-unanime'],
        roomNotes: [{ id: 'm2', author: 'Maria', role: 'PO', text: 'vamos comecar', type: 'chat', createdAt: '2026-09-05T09:59:00.000Z' }],
      },
    });
    const csv = await service.exportCsv('report-1', token);
    expect(csv).toContain('"Historia","Status","Valor final"');
    expect(csv).toContain('"Login","estimada","5"');
    expect(csv).toContain('"SECAO","Resumo da sessao"');
    expect(csv).toContain('"SECAO","Participacao"');
    expect(csv).toContain('"Maria","1","2"');
    expect(csv).toContain('"SECAO","Badges"');
    expect(csv).toContain('"Badge","Consenso unânime"');
    expect(csv).toContain('"SECAO","Anotacoes da mesa"');
    expect(csv).toContain('"Maria","PO","chat","vamos comecar"');
  });

  it('renders PDF export only with a valid room session', async () => {
    const token = session.issueGuest('room-1', 'participant-1', 'guest-1').token;
    prisma.sprintReport.findUnique = async () => ({ id: 'report-1', roomId: 'room-1', summary: { stories: [{ title: 'Login', status: 'estimada', finalValue: '5', rounds: 1 }] } });
    const pdf = await service.exportPdf('report-1', token);
    expect(pdf.subarray(0, 8).toString()).toBe('%PDF-1.4');
  });
});