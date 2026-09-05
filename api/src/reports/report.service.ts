import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { AuthorizationService } from '../auth/authorization.service.js';
import { SessionService } from '../auth/session.service.js';
import { AchievementsService, BADGE_LABELS } from './achievements.service.js';
import { PdfExportService } from './pdf-export.service.js';
import { InsightsService } from './insights.service.js';
import type { ReportOptions } from '@planning-poker/shared-types';

type ReportAccess = { participantId: string; role: string };

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly sessions: SessionService,
    private readonly achievements: AchievementsService,
    private readonly pdf: PdfExportService,
    private readonly insights: InsightsService,
  ) {}

  async generate(roomIdOrCode: string, options?: ReportOptions) {
    const include = this.reportInclude();
    const byId = await this.prisma.room.findUnique({ where: { id: roomIdOrCode }, include });
    const room = byId ?? (await this.prisma.room.findFirst({ where: { inviteCode: roomIdOrCode.toUpperCase() }, include }));
    if (!room) throw new NotFoundException('Room not found');
    // Regenera sempre: um relatorio pode ter sido gerado por uma versao antiga do codigo
    // (ex.: antes das justificativas) e o usuario pode clicar de novo para refletir o estado atual.
    const existing = await this.prisma.sprintReport.findFirst({ where: { roomId: room.id }, orderBy: { generatedAt: 'desc' } });
    if (existing) await this.prisma.sprintReport.delete({ where: { id: existing.id } });
    const summary = this.toSummary(room, options);
    if (options?.withInsights !== false) {
      summary.insights = await this.insights.generate(summary, room.config);
    }
    const report = await this.prisma.sprintReport.create({ data: { roomId: room.id, summary } });
    await this.prisma.room.update({ where: { id: room.id }, data: { status: 'encerrada' } });
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
    const line = (cells: any[]) => cells.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',');
    const csv: string[] = [];

    // Cabecalho do documento (espelho da tela: sala, codigo, data).
    csv.push(line(['Sala', summary.roomName ?? '']));
    csv.push(line(['Codigo', summary.roomCode ?? '']));
    csv.push(line(['Gerado em', summary.generatedAt ?? '']));
    csv.push('');

    // Historias: tabela tabular (mesmas colunas de antes).
    csv.push(line(['SECAO', 'Historias']));
    csv.push(line(['Historia', 'Status', 'Valor final', 'Rodadas', 'Segundos', 'Criterio', 'Justificativas', 'Ideias de tasks']));
    for (const story of summary.stories ?? []) {
      csv.push(line([
        story.title,
        story.status,
        story.finalValue ?? '',
        story.rounds ?? 0,
        story.totalSeconds ?? 0,
        story.criterion ?? '',
        (story.roundsDetail ?? [])
          .flatMap((round: any) => round.voteDetails ?? [])
          .map((vote: any) => `${vote.participantName} (${vote.value})${vote.justification ? ': ' + vote.justification : ''}`)
          .join(' | '),
        summary.insights?.perStory?.find((insight: any) => insight.storyId === story.id)?.suggestedTasks?.join(' | ') ?? '',
      ]));
    }

    const overall = summary.insights?.overall;
    if (overall) {
      csv.push('');
      csv.push(line(['SECAO', 'Resumo da sessao']));
      csv.push(line(['Sintese', overall.summary ?? '']));
      if ((overall.suggestedTasks ?? []).length > 0) csv.push(line(['Tasks', overall.suggestedTasks.join(' | ')]));
    }

    csv.push('');
    csv.push(line(['SECAO', 'Participacao']));
    csv.push(line(['Nome', 'Votos', 'Comentarios']));
    for (const person of summary.participation ?? []) {
      csv.push(line([person.name ?? person.participantId, person.votes ?? 0, person.comments ?? 0]));
    }

    const badges = (summary.achievements ?? []).map((slug: string) => BADGE_LABELS[slug] ?? slug);
    if (badges.length > 0) {
      csv.push('');
      csv.push(line(['SECAO', 'Badges']));
      for (const badge of badges) csv.push(line(['Badge', badge]));
    }

    const notes = summary.roomNotes ?? [];
    if (notes.length > 0) {
      csv.push('');
      csv.push(line(['SECAO', 'Anotacoes da mesa']));
      csv.push(line(['Autor', 'Papel', 'Tipo', 'Texto']));
      for (const note of notes) csv.push(line([note.author, note.role, note.type, note.text]));
    }

    return csv.join('\n');
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
    return {
      stories: { orderBy: { order: 'asc' }, include: { voteRounds: { orderBy: { number: 'asc' }, include: { votes: true } } } },
      messages: { orderBy: { createdAt: 'asc' } },
      participants: { include: { user: true } },
      config: true,
    } as const;
  }

  private toSummary(room: any, options?: ReportOptions): any {
    const who = new Map<string, any>(room.participants.map((participant: any) => [participant.id, participant]));
    const withChat = options?.withChat !== false;
    const withVotes = options?.withVotes !== false;
    const withRoomNotes = options?.withRoomNotes !== false;
    const anonymous = room.config?.votoAnonimo === true;
    const authorOf = (participantId: string) => {
      const author = who.get(participantId);
      return author?.roomDisplayName ?? author?.user?.name ?? participantId;
    };
    const roleOf = (participantId: string) => {
      const author = who.get(participantId);
      return author?.role ?? 'Dev';
    };
    const stories = room.stories.map((story: any) => ({
      id: story.id,
      title: story.title,
      description: story.description,
      order: story.order,
      status: story.status,
      finalValue: story.finalValue,
      criterion: story.criterion,
      rounds: story.rounds,
      totalSeconds: this.storyTotalSeconds(story.voteRounds),
      divergenceInitial: this.divergence(story.voteRounds[0]?.votes),
      divergenceFinal: this.divergence(story.voteRounds.at(-1)?.votes),
      roundsDetail: story.voteRounds.map((round: any) => ({
        number: round.number,
        startedAt: round.startedAt,
        endedAt: round.endedAt,
        timerType: round.timerType,
        timerDeadline: round.timerDeadline,
        votes: round.votes.length,
        durationSeconds: this.roundDurationSeconds(round),
        voteDetails: withVotes
          ? round.votes
              .filter((vote: any) => vote.revealed === true)
              .slice()
              .sort((a: any, b: any) => new Date(a.castAt).getTime() - new Date(b.castAt).getTime())
              .map((vote: any) => ({
                participantName: anonymous ? 'Participante' : authorOf(vote.participantId),
                value: vote.value,
                justification: vote.justification ?? null,
              }))
          : [],
      })),
      comments: withChat
        ? room.messages
            .filter((message: any) => message.storyId === story.id)
            .map((message: any) => ({
              id: message.id,
              author: authorOf(message.participantId),
              role: roleOf(message.participantId),
              text: message.text,
              type: message.type,
              createdAt: message.createdAt.toISOString(),
            }))
        : [],
    }));
    const participation = room.participants.map((participant: any) => ({
      participantId: participant.id,
      name: authorOf(participant.id),
      votes: room.stories.flatMap((story: any) => story.voteRounds).flatMap((round: any) => round.votes).filter((vote: any) => vote.participantId === participant.id).length,
      comments: room.messages.filter((message: any) => message.participantId === participant.id).length,
    }));
    return {
      roomId: room.id,
      roomName: room.name,
      roomCode: room.inviteCode,
      generatedAt: new Date().toISOString(),
      stories,
      participation,
      achievements: this.achievements.calculate(stories, participation),
      roomNotes: withRoomNotes
        ? room.messages
            .filter((message: any) => !message.storyId)
            .map((message: any) => ({
              id: message.id,
              author: authorOf(message.participantId),
              role: roleOf(message.participantId),
              text: message.text,
              type: message.type,
              createdAt: message.createdAt.toISOString(),
            }))
        : [],
    };
  }

  private roundDurationSeconds(round: any) {
    const end = round.endedAt ?? round.timerDeadline;
    if (!end || !round.startedAt) return 0;
    const endMs = new Date(end).getTime();
    const startMs = new Date(round.startedAt).getTime();
    return Math.max(0, Math.round((endMs - startMs) / 1000));
  }

  private storyTotalSeconds(voteRounds: any[]) {
    return (voteRounds ?? []).reduce((total, round) => total + this.roundDurationSeconds(round), 0);
  }

  private divergence(votes: any[] | undefined) {
    const values = (votes ?? []).map((vote) => Number(vote.value)).filter(Number.isFinite);
    if (values.length < 2) return null;
    return { min: Math.min(...values), max: Math.max(...values), spread: Math.max(...values) - Math.min(...values) };
  }
}