import { Injectable } from '@nestjs/common';
import { LlmClient } from '../ai/llm.client.js';

export type InsightsResult = {
  overall: { summary: string; suggestedTasks: string[] };
  perStory: { storyId: string; title: string; summary: string; suggestedTasks: string[] }[];
};

type InsightStory = {
  id: string;
  title: string;
  status: string;
  finalValue?: number | string | null;
  rounds?: number;
  totalSeconds?: number;
  criterion?: string | null;
  divergenceInitial?: { min: number; max: number; spread: number } | null;
  divergenceFinal?: { min: number; max: number; spread: number } | null;
  comments?: unknown[];
};

@Injectable()
export class InsightsService {
  constructor(private readonly llm: LlmClient) {}

  /** Híbrido: tenta LLM (se LLM_API_KEY presente e responde); em qualquer falha cai para heurísticas determinísticas. */
  async generate(summary: any, config?: { tempoReflexaoSegundos?: number } | null): Promise<InsightsResult> {
    try {
      return await this.fromLlm(summary);
    } catch {
      return this.fromHeuristics(summary, config);
    }
  }

  private async fromLlm(summary: any): Promise<InsightsResult> {
    const stories = (summary.stories ?? []) as InsightStory[];
    const flat = stories.map((story) =>
      `${story.title}: ${story.status}${story.finalValue != null ? `, final ${story.finalValue}` : ''}${story.criterion ? `, criterio ${story.criterion}` : ''}, ${story.rounds ?? 0} rodada(s), ${story.totalSeconds ?? 0}s${story.divergenceInitial?.spread ? `, divergencia inicial ${story.divergenceInitial.spread}` : ''}${story.divergenceFinal?.spread ? `, divergencia final ${story.divergenceFinal.spread}` : ''}${(story.comments?.length ?? 0) > 0 ? `, ${story.comments?.length} comentario(s)` : ''}`,
    );
    const result = await this.llm.summarize({ stories: flat });
    return {
      overall: { summary: result.overallSummary, suggestedTasks: [] },
      perStory: result.perStory.map((item) => ({
        storyId: stories.find((story) => this.matches(item.title, story.title))?.id ?? '',
        title: item.title,
        summary: item.summary,
        suggestedTasks: item.suggestedTasks,
      })),
    };
  }

  private matches(a: string, b: string) {
    const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
    return norm(a) === norm(b) || norm(a).includes(norm(b)) || norm(b).includes(norm(a));
  }

  private fromHeuristics(summary: any, config?: { tempoReflexaoSegundos?: number } | null): InsightsResult {
    const stories = (summary.stories ?? []) as InsightStory[];
    const threshold = (config?.tempoReflexaoSegundos ?? 120) * 2;
    const perStory = stories.map((story) => {
      const tasks: string[] = [];
      let text: string;
      if (story.status === 'pulada') {
        text = `"${story.title}" foi pulada — nenhum valor final definido nesta sessão.`;
        tasks.push('Revisar e reestimar a história em uma próxima sessão');
      } else {
        text = `"${story.title}" foi estimada em ${story.finalValue ?? '-'} após ${story.rounds ?? 0} rodada(s) (${story.totalSeconds ?? 0}s de votação).`;
        if (story.rounds && story.rounds >= 2) {
          tasks.push('Documentar a divergência entre as rodadas como decisão de escopo');
        }
        if (story.divergenceInitial && story.divergenceInitial.spread > 0) {
          tasks.push('Detalhar critérios de aceite da história com o time');
        }
      }
      if ((story.totalSeconds ?? 0) > threshold) {
        tasks.push('Quebrar a história em partes menores para reduzir o tempo de estimativa');
      }
      if ((story.comments?.length ?? 0) > 0) {
        tasks.push('Converter justificativas/observações do chat em tasks de implementação');
      }
      if (tasks.length === 0) {
        tasks.push('Refinar a história com critérios de aceite explícitos');
      }
      return { storyId: story.id, title: story.title, summary: text, suggestedTasks: tasks.slice(0, 4) };
    });

    const estimadas = stories.filter((story) => story.status === 'estimada').length;
    const puladas = stories.filter((story) => story.status === 'pulada').length;
    const points = stories
      .filter((story) => story.status === 'estimada')
      .reduce<number>((total, story) => total + (Number(story.finalValue) || 0), 0);
    const rounds = stories.reduce<number>((total, story) => total + (story.rounds ?? 0), 0);
    const average = stories.length ? rounds / stories.length : 0;

    const overallTasks = [...new Set(perStory.flatMap((item) => item.suggestedTasks))].slice(0, 6);
    return {
      overall: {
        summary: `${estimadas} história(s) estimada(s) e ${puladas} pulada(s) de ${stories.length} no total; ${points} ponto(s) estimado(s); média de ${average.toFixed(1)} rodada(s) por história.`,
        suggestedTasks: overallTasks,
      },
      perStory: perStory,
    };
  }
}
