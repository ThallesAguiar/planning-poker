import { describe, expect, it } from 'vitest';
import { AchievementsService } from './achievements.service.js';

describe('AchievementsService', () => {
  it('awards badges from durable session facts', () => {
    const badges = new AchievementsService().calculate([{ status: 'estimada' }], [{ votes: 2, comments: 1 }]);
    expect(badges).toEqual(['primeira-estimativa', 'backlog-concluido', 'time-participativo']);
  });
});
