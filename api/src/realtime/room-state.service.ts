import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RoomStateService implements OnModuleDestroy {
  private readonly memory = new Map<string, Record<string, unknown>>();
  private redis?: Redis;

  async save(roomId: string, state: Record<string, unknown>) {
    this.memory.set(roomId, state);
    const redis = this.client();
    if (redis) await redis.set(`planning-poker:room:${roomId}`, JSON.stringify(state), 'EX', 86_400).catch(() => undefined);
  }

  async restore(roomId: string) {
    const redis = this.client();
    if (redis) {
      const raw = await redis.get(`planning-poker:room:${roomId}`).catch(() => null);
      if (raw) { try { const state = JSON.parse(raw) as Record<string, unknown>; this.memory.set(roomId, state); return state; } catch { /* fallback to memory */ } }
    }
    return this.memory.get(roomId);
  }

  async clear(roomId: string) {
    this.memory.delete(roomId);
    const redis = this.client();
    if (redis) await redis.del(`planning-poker:room:${roomId}`).catch(() => undefined);
  }

  private client() {
    if (!process.env.REDIS_URL) return undefined;
    this.redis ??= new Redis(process.env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 1 });
    return this.redis;
  }

  async onModuleDestroy() { if (this.redis) await this.redis.quit().catch(() => undefined); }
}
