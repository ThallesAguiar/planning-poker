import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { AuthorizationService } from '../auth/authorization.service.js';
import { SessionService } from '../auth/session.service.js';
import { AchievementsService } from './achievements.service.js';
import { PdfExportService } from './pdf-export.service.js';

type ReportAccess = { participantId: string; role: string };

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly sessions: SessionService,
    private readonly achievements: AchievementsService,
    private readonly pdf: PdfExportService,
  ) {}

  async generate(roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, include: this.reportInclude() });
    if (!room) throw new NotFoundException('Room not found');
    const existing = await this.prisma.sprintReport.findFirst({ where: { roomId }, orderBy: { generatedAt: 'desc' } });
    if (existing) return existing;
    const report = await this.prisma.sprintReport.create({ data: { roomId, summary: this.toSummary(room) } });
    await this.prisma.room.update({ where: { id: roomId }, data: { status: 'encerrada' } });
    return report;
  }

  async listForRoom(roomId: string, token: string) {
    await this.requireMember(roomId, token);
    return this.prisma.sprintReport.findMany({ where: { roomId }, orderBy: { generatedAt: 'desc' } });
  }

  async get(reportId: string, token: string) {
    const report = await this.prisma.sprintReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    await this.requireMember(report.roomId, token);
    return report;
  }

  async exportCsv(reportId: string, token: string) {
    const report = await this.getWithAccess(reportId, token);
    if (!this.authorization.canExportReport(report.access.role, report.access.role === 'ScrumMaster')) throw new ForbiddenException('Export not authorized');
    const summary = report.report.summary as any;
    const rows: string[][] = [['Historia', 'Status', 'Valor final', 'Rodadas', 'Segundos', 'Criterio'], ...(summary.stories ?? []).map((story: any) => [String(story.title), String(story.status), String(story.finalValue ?? ''), String(story.rounds ?? 0), String(story.totalSeconds ?? 0), String(story.criterion ?? '')])];
    return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  }

  async exportPdf(reportId: string, token: string) {
    const report = await this.getWithAccess(reportId, token);
    if (!this.authorization.canExportReport(report.access.role, report.access.role === 'ScrumMaster')) throw new ForbiddenException('Export not authorized');
    return this.pdf.render(report.report.summary);
  }

  private async getWithAccess(reportId: string, token: string) {
    const report = await this.prisma.sprintReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    return { report, access: await this.requireMember(report.roomId, token) };
  }

  private async requireMember(roomId: string, token: string): Promise<ReportAccess> {
    if (!token) throw new UnauthorizedException('Room session required');
    let session;
    try { session = this.sessions.verify(token); } catch { throw new UnauthorizedException('Invalid room session'); }
    if (session.roomId !== roomId || !session.participantId) throw new ForbiddenException('Room membership required');
    const participant = await this.prisma.roomParticipant.findFirst({ where: { id: session.participantId, roomId, status: 'ativo' } });
    if (!participant || !this.authorization.canViewReport(true)) throw new ForbiddenException('Room membership required');
    return { participantId: participant.id, role: participant.role };
  }

  private reportInclude() {
    return { stories: { include: { voteRounds: { include: { votes: true } } } }, messages: true, participants: true } as const;
  }

  private toSummary(room: any) {
    const stories = room.stories.map((story: any) => ({ id: story.id, title: story.title, description: story.description, order: story.order, status: story.status, finalValue: story.finalValue, criterion: story.criterion, rounds: story.rounds, totalSeconds: story.totalSeconds, divergenceInitial: this.divergence(story.voteRounds[0]?.votes), divergenceFinal: this.divergence(story.voteRounds.at(-1)?.votes), roundsDetail: story.voteRounds.map((round: any) => ({ number: round.number, startedAt: round.startedAt, endedAt: round.endedAt, votes: round.votes.length })) }));
    const participation = room.participants.map((participant: any) => ({ participantId: participant.id, votes: room.stories.flatMap((story: any) => story.voteRounds).flatMap((round: any) => round.votes).filter((vote: any) => vote.participantId === participant.id).length, comments: room.messages.filter((message: any) => message.participantId === participant.id).length }));
    return { roomId: room.id, generatedAt: new Date().toISOString(), stories, participation, achievements: this.achievements.calculate(stories, participation) };
  }

  private divergence(votes: any[] | undefined) {
    const values = (votes ?? []).map((vote) => Number(vote.value)).filter(Number.isFinite);
    if (values.length < 2) return null;
    return { min: Math.min(...values), max: Math.max(...values), spread: Math.max(...values) - Math.min(...values) };
  }
}
