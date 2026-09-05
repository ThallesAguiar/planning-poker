import { describe, expect, it } from 'vitest';
import { AchievementsService } from './achievements.service.js';

describe('AchievementsService', () => {
  it('awards badges from durable session facts', () => {
    const badges = new AchievementsService().calculate([{ status: 'estimada' }], [{ votes: 2, comments: 1 }]);
    expect(badges).toEqual(['primeira-estimativa', 'backlog-concluido', 'time-participativo', 'todos-votaram']);
  });

  it('awards consensus, divergence and participation badges', () => {
    const stories = [
      { status: 'estimada', criterion: 'unanime' },
      { status: 'estimada', criterion: 'decisao_po', divergenceInitial: { spread: 5 }, divergenceFinal: { spread: 2 } },
      { status: 'estimada', criterion: 'media', divergenceInitial: { spread: 3 }, divergenceFinal: { spread: 3 } },
    ];
    const badges = new AchievementsService().calculate(stories, [{ votes: 3, comments: 1 }, { votes: 2, comments: 0 }]);
    expect(badges).toEqual(['primeira-estimativa', 'backlog-concluido', 'time-participativo', 'consenso-unanime', 'divergencia-resolvida', 'todos-votaram']);
  });

  it('does not award divergence badge when divergence never narrows', () => {
    const badges = new AchievementsService().calculate([{ status: 'estimada', divergenceInitial: { spread: 2 }, divergenceFinal: { spread: 5 } }], []);
    expect(badges).not.toContain('divergencia-resolvida');
  });
});