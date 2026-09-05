import { describe, expect, it } from 'vitest';
import { PdfExportService } from './pdf-export.service.js';

const service = new PdfExportService();

function fullSummary(overrides: Record<string, unknown> = {}) {
  return {
    roomId: 'room-1',
    roomName: 'Sprint Sessão 32',
    roomCode: 'SPRINT',
    generatedAt: '2026-09-05T10:00:00.000Z',
    achievements: ['consenso-unanime'],
    stories: [
      {
        id: 'story-1',
        title: 'Login',
        description: '',
        order: 1,
        status: 'estimada',
        finalValue: '5',
        criterion: 'decisao_po',
        rounds: 2,
        totalSeconds: 120,
        roundsDetail: [
          {
            number: 1,
            voteDetails: [{ participantName: 'Ana', value: '5', justification: 'simples de implementar' }, { participantName: 'Bia', value: '8', justification: null }],
            votes: 2,
            durationSeconds: 60,
          },
          {
            number: 2,
            voteDetails: [{ participantName: 'Ana', value: '5', justification: null }, { participantName: 'Bia', value: '5', justification: null }],
            votes: 2,
            durationSeconds: 60,
          },
        ],
        comments: [{ id: 'm1', author: 'Ana', role: 'PO', text: 'fechou no 5', type: 'justificativa', createdAt: '2026-09-05T10:02:00.000Z' }],
      },
    ],
    insights: {
      overall: { summary: 'Resumo geral da sessão', suggestedTasks: ['task de resumo'] },
      perStory: [{ storyId: 'story-1', title: 'Login', summary: 'Sintese gerada', suggestedTasks: ['task 1', 'task 2'] }],
    },
    participation: [{ participantId: 'participant-1', name: 'Ana', votes: 2, comments: 1 }],
    roomNotes: [{ id: 'm2', author: 'Ana', role: 'PO', text: 'vamos começar', type: 'chat', createdAt: '2026-09-05T09:59:00.000Z' }],
    ...overrides,
  };
}

describe('PdfExportService', () => {
  it('serializes the report into readable lines mirroring the screen', () => {
    const lines = service.layout(fullSummary());
    expect(lines[0]).toBe('Planning Poker - Relatorio');
    expect(lines.join('\n')).toContain('Sala Sprint Sessão 32 · codigo SPRINT');
    expect(lines.join('\n')).toContain('Consenso unânime');
    expect(lines.join('\n')).toContain('--- Historias ---');
    expect(lines.join('\n')).toContain('Login [estimada] Valor: 5 | 2 rodada(s) | 120s | criterio decisao_po');
    expect(lines.join('\n')).toContain('Rodada 1: Ana -> 5 "simples de implementar"; Bia -> 8');
    expect(lines.join('\n')).toContain('Rodada 2: Ana -> 5; Bia -> 5');
    expect(lines.join('\n')).toContain('# Ana [justificativa]: fechou no 5');
    expect(lines.join('\n')).toContain('Sintese: Sintese gerada');
    expect(lines.join('\n')).toContain('--- Resumo da sessao ---');
    expect(lines.join('\n')).toContain('--- Participacao ---');
    expect(lines.join('\n')).toContain('Ana: 2 voto(s), 1 comentario(s)');
    expect(lines.join('\n')).toContain('--- Anotacoes da mesa ---');
    expect(lines.join('\n')).toContain('Ana (PO) [chat]: vamos começar');
  });

  it('keeps Latin-1 accents in the layout instead of stripping them', () => {
    const lines = service.layout(fullSummary());
    // 'Sessão', 'unânime' preservados; o escape do render mantem Latin-1.
    expect(lines.join('\n')).toContain('Sessão');
    expect(lines.join('\n')).toContain('Consenso unânime');
    const pdf = service.render(fullSummary());
    expect(pdf.toString('latin1')).toContain('Sessão');
  });

  it('renders a readable PDF document from report facts', () => {
    const pdf = service.render(fullSummary());
    expect(pdf.subarray(0, 8).toString()).toBe('%PDF-1.4');
    expect(pdf.toString('latin1')).toContain('xref');
    expect(pdf.toString('latin1')).toContain('WinAnsiEncoding');
  });

  it('paginates into multiple pages when the report is long', () => {
    const stories = Array.from({ length: 60 }, (_, index) => ({
      id: `story-${index}`,
      title: `História ${index}`,
      status: 'estimada',
      finalValue: '5',
      rounds: 1,
      totalSeconds: 30,
      roundsDetail: [],
      comments: [],
    }));
    const lines = service.layout(fullSummary({ stories }));
    expect(lines.length).toBeGreaterThan(38); // estoura uma pagina
    const pdf = service.render(fullSummary({ stories }));
    expect(pdf.toString('latin1')).toMatch(/\/Count [2-9]/);
  });
});