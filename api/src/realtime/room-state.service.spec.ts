import { describe, expect, it, vi } from 'vitest';
import { RoomStateService } from './room-state.service.js';

describe('RoomStateService', () => {
  it('stores and restores state through memory when Redis is unavailable', async () => {
    vi.stubEnv('REDIS_URL', '');
    const service = new RoomStateService();
    await service.save('room-1', { phase: 'votacao', roundId: 'round-1' });
    expect(await service.restore('room-1')).toEqual({ phase: 'votacao', roundId: 'round-1' });
    await service.clear('room-1');
    expect(await service.restore('room-1')).toBeUndefined();
    vi.unstubAllEnvs();
  });
});
