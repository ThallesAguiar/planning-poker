import { Injectable } from '@nestjs/common';

type ReportStory = {
  status: string;
  criterion?: string | null;
  divergenceInitial?: { spread: number } | null;
  divergenceFinal?: { spread: number } | null;
};

// Mesmos rotulos do frontend (`frontend/src/features/report/ReportPage.tsx`), para que PDF/CSV
// mostrem o badge com o mesmo nome que a tela.
export const BADGE_LABELS: Record<string, string> = {
  'primeira-estimativa': 'Primeira estimativa',
  'backlog-concluido': 'Backlog concluído',
  'time-participativo': 'Time participativo',
  'consenso-unanime': 'Consenso unânime',
  'divergencia-resolvida': 'Divergência resolvida',
  'todos-votaram': 'Todos votaram',
};

@Injectable()
export class AchievementsService {
  calculate(stories: ReportStory[], participation: Array<{ votes: number; comments: number }>) {
    const badges: string[] = [];
    if (stories.some((story) => story.status === 'estimada')) badges.push('primeira-estimativa');
    if (stories.length > 0 && stories.every((story) => story.status === 'estimada' || story.status === 'pulada')) badges.push('backlog-concluido');
    if (participation.some((person) => person.votes > 0 && person.comments > 0)) badges.push('time-participativo');
    if (stories.some((story) => story.criterion === 'unanime')) badges.push('consenso-unanime');
    if (stories.some((story) => story !== null && story.divergenceInitial && story.divergenceFinal && story.divergenceFinal.spread < story.divergenceInitial.spread)) badges.push('divergencia-resolvida');
    if (participation.length > 0 && participation.every((person) => person.votes >= 1)) badges.push('todos-votaram');
    return badges;
  }
}