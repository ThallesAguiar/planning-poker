import { Injectable } from '@nestjs/common';
import { BADGE_LABELS } from './achievements.service.js';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const TOP = 790;
const LINE_HEIGHT = 18;
const FONT_SIZE = 12;
const MAX_LINES_PER_PAGE = 38;

@Injectable()
export class PdfExportService {
  /**
   * Serializa a summary do relatorio em linhas de texto, no mesmo layout da tela
   * (`frontend/src/features/report/ReportPage.tsx`). Publico e testavel; `render()`
   * apenas pagina essas linhas.
   */
  layout(summary: any): string[] {
    const lines: string[] = [];
    const push = (text: string) => lines.push(text);

    push('Planning Poker - Relatorio');
    const room = summary.roomName ?? (summary.roomId ? `#${summary.roomId}` : '');
    const code = summary.roomCode ? ` · codigo ${summary.roomCode}` : '';
    const stamp = summary.generatedAt ? ` · ${this.formatDate(summary.generatedAt)}` : '';
    if (room || code || stamp) push(`Sala ${room}${code}${stamp}`);

    const badges = (summary.achievements ?? []).map((slug: string) => BADGE_LABELS[slug] ?? slug);
    if (badges.length > 0) push(`Badges: ${badges.join(', ')}`);

    push('');
    push('--- Historias ---');
    for (const story of summary.stories ?? []) {
      const criterion = story.criterion ? ` | criterio ${story.criterion}` : '';
      push(`${story.title} [${story.status}] Valor: ${story.finalValue ?? '-'} | ${story.rounds ?? 0} rodada(s) | ${story.totalSeconds ?? 0}s${criterion}`);
      for (const round of story.roundsDetail ?? []) {
        const details = round.voteDetails ?? [];
        if (details.length > 0) {
          const parts = details.map((vote: any) => `${vote.participantName} -> ${vote.value}${vote.justification ? ` "${vote.justification}"` : ''}`);
          push(`  Rodada ${round.number}: ${parts.join('; ')}`);
        } else {
          push(`  Rodada ${round.number}: ${round.votes ?? 0} voto(s) · ${round.durationSeconds ?? 0}s`);
        }
      }
      for (const comment of story.comments ?? []) {
        push(`  # ${comment.author} [${comment.type}]: ${comment.text}`);
      }
      const insight = (summary.insights?.perStory ?? []).find((item: any) => item.storyId === story.id);
      if (insight) {
        push(`  Sintese: ${insight.summary}`);
        if ((insight.suggestedTasks ?? []).length > 0) push(`  Tasks: ${insight.suggestedTasks.join(' | ')}`);
      }
    }

    const overall = summary.insights?.overall;
    if (overall) {
      push('');
      push('--- Resumo da sessao ---');
      push(overall.summary);
      if ((overall.suggestedTasks ?? []).length > 0) push(`Tasks: ${overall.suggestedTasks.join(' | ')}`);
    }

    push('');
    push('--- Participacao ---');
    for (const person of summary.participation ?? []) {
      push(`${person.name ?? person.participantId}: ${person.votes ?? 0} voto(s), ${person.comments ?? 0} comentario(s)`);
    }

    const notes = summary.roomNotes ?? [];
    if (notes.length > 0) {
      push('');
      push('--- Anotacoes da mesa ---');
      for (const note of notes) {
        push(`${note.author} (${note.role}) [${note.type}]: ${note.text}`);
      }
    }

    return lines;
  }

  render(summary: any): Buffer {
    const lines = this.layout(summary);
    const pages: string[] = [];
    for (let index = 0; index < lines.length; index += MAX_LINES_PER_PAGE) {
      pages.push(this.pageContent(lines.slice(index, index + MAX_LINES_PER_PAGE)));
    }
    if (pages.length === 0) pages.push('BT\n/F1 12 Tf\n50 790 Td\n() Tj\nET');

    const count = pages.length;
    // Refs dos objetos (1-indexados): 1 Catalog, 2 Pages, pares (Page, Contents) por pagina,
    // depois as duas fontes.
    const pageRef = (pageIndex: number) => 3 + pageIndex * 2;
    const contentsRef = (pageIndex: number) => 4 + pageIndex * 2;
    const f1Ref = 3 + count * 2;
    const f2Ref = 4 + count * 2;

    const pageObjects: string[] = [];
    for (let pageIndex = 0; pageIndex < count; pageIndex += 1) {
      pageObjects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${f1Ref} 0 R /F2 ${f2Ref} 0 R >> >> /Contents ${contentsRef(pageIndex)} 0 R >>`,
        `<< /Length ${Buffer.byteLength(pages[pageIndex], 'latin1')} >>\nstream\n${pages[pageIndex]}\nendstream`,
      );
    }
    const kids = Array.from({ length: count }, (_, index) => `${pageRef(index)} 0 R`).join(' ');
    const objects = [
      `<< /Type /Catalog /Pages 2 0 R >>`,
      `<< /Type /Pages /Kids [${kids}] /Count ${count} >>`,
      ...pageObjects,
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
      `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf, 'latin1');
  }

  private pageContent(pageLines: string[]) {
    const rows: string[] = ['BT', '/F1 12 Tf', `50 ${TOP} Td`];
    pageLines.forEach((line, index) => {
      if (index > 0) rows.push('0 -18 Td');
      const bold = line.startsWith('--- ') || index === 0;
      rows.push(`${bold ? '/F2 12 Tf' : '/F1 12 Tf'} (${this.escape(line.slice(0, 110))}) Tj`);
    });
    rows.push('ET');
    return rows.join('\n');
  }

  private formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('pt-BR');
  }

  // Mantem acentos Latin-1 (que o stream grava em latin1); so substitui por '?' o que
  // estiver fora de 0x20-0xFF.
  private escape(value: string) {
    return value
      .replace(/[^\x20-\xFF]/g, '?')
      .replaceAll('\\', '\\\\')
      .replaceAll('(', '\\(')
      .replaceAll(')', '\\)');
  }
}