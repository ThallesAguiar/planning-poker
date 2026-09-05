import { describe, expect, it, vi } from 'vitest';
import { InsightsService } from './insights.service.js';
import { ServiceUnavailableException } from '@nestjs/common';

function story(over: Record<string, any> = {}) {
  return {
    id: 'story-1',
    title: 'Login',
    status: 'estimada',
    finalValue: '5',
    rounds: 1,
    totalSeconds: 90,
    criterion: null,
    divergenceInitial: null,
    divergenceFinal: null,
    comments: [],
    ...over,
  };
}

describe('InsightsService', () => {
  it('returns deterministic heuristics when the LLM is unavailable', async () => {
    const llm: any = { summarize: vi.fn(async () => { throw new ServiceUnavailableException('AI_UNAVAILABLE'); }) };
    const service = new InsightsService(llm);
    const result = await service.generate({ stories: [story()] }, { tempoReflexaoSegundos: 120 });
    expect(llm.summarize).toHaveBeenCalled();
    expect(result.overall.summary).toContain('1');
    expect(result.overall.summary).toContain('ponto');
    expect(result.perStory).toHaveLength(1);
    expect(result.perStory[0].summary).toContain('estimada em 5');
  });

  it('derives a task from initial divergence (spread > 0)', async () => {
    const service = new InsightsService({ summarize: vi.fn(async () => { throw new ServiceUnavailableException('AI_UNAVAILABLE'); }) } as any);
    const result = await service.generate({
      stories: [story({ divergenceInitial: { min: 1, max: 8, spread: 7 } })],
    } as any);
    expect(result.perStory[0].suggestedTasks).toContain('Detalhar critérios de aceite da história com o time');
  });

  it('derives a revisit task for a skipped story and a break-up task when time is high', async () => {
    const service = new InsightsService({ summarize: vi.fn(async () => { throw new ServiceUnavailableException('AI_UNAVAILABLE'); }) } as any);
    const result = await service.generate({
      stories: [
        story({ id: 'skipped', title: 'Menu', status: 'pulada', finalValue: null, totalSeconds: 200 }),
        story({ id: 'slow', title: 'Dashboard', status: 'estimada', finalValue: '13', totalSeconds: 400, rounds: 3 }),
      ],
    } as any);
    const tasks = new Set(result.perStory.flatMap((item) => item.suggestedTasks));
    expect(tasks.has('Revisar e reestimar a história em uma próxima sessão')).toBe(true);
    expect(tasks.has('Quebrar a história em partes menores para reduzir o tempo de estimativa')).toBe(true);
    expect(tasks.has('Documentar a divergência entre as rodadas como decisão de escopo')).toBe(true);
  });

  it('falls back to heuristics when the LLM returns an invalid shape', async () => {
    const llm: any = { summarize: vi.fn(async () => { throw new ServiceUnavailableException('AI_INVALID_OUTPUT'); }) };
    const service = new InsightsService(llm);
    const result = await service.generate({ stories: [story()] } as any);
    expect(result.perStory[0].suggestedTasks.length).toBeGreaterThan(0);
  });

  it('uses the LLM result when available', async () => {
    const llm: any = { summarize: vi.fn(async () => ({ overallSummary: 'Bom fluxo.', perStory: [{ title: 'Login', summary: 'Fechou rápido.', suggestedTasks: ['Ajustar layout'] }] })) };
    const service = new InsightsService(llm);
    const result = await service.generate({ stories: [story()] } as any);
    expect(result.overall.summary).toBe('Bom fluxo.');
    expect(result.perStory[0].suggestedTasks).toEqual(['Ajustar layout']);
  });
});