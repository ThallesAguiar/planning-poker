import { Injectable } from '@nestjs/common';

@Injectable()
export class AchievementsService {
  calculate(stories: Array<{ status: string }>, participation: Array<{ votes: number; comments: number }>) {
    const badges: string[] = [];
    if (stories.some((story) => story.status === 'estimada')) badges.push('primeira-estimativa');
    if (stories.length > 0 && stories.every((story) => story.status === 'estimada' || story.status === 'pulada')) badges.push('backlog-concluido');
    if (participation.some((person) => person.votes > 0 && person.comments > 0)) badges.push('time-participativo');
    return badges;
  }
}
