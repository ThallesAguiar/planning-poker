import { describe, expect, it, vi } from 'vitest';
import { TimerService } from './timer.service.js';

describe('TimerService', () => {
  it('emits a server-derived countdown and expires exactly once', async () => {
    vi.useFakeTimers();
    const service = new TimerService();
    const ticks: number[] = [];
    const expired = vi.fn();
    const deadline = new Date(Date.now() + 2_000);

    service.schedule({ key: 'round-1', type: 'reflexao', deadline }, (seconds) => ticks.push(seconds), expired);
    await vi.advanceTimersByTimeAsync(2_100);

    expect(ticks).toContain(2);
    expect(ticks).toContain(1);
    expect(ticks).toContain(0);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(service.activeCount).toBe(0);
    vi.useRealTimers();
  });

  it('replaces and cancels timers by key', () => {
    vi.useFakeTimers();
    const service = new TimerService();
    const first = vi.fn();
    const second = vi.fn();
    const now = Date.now();

    service.schedule({ key: 'round-1', type: 'reflexao', deadline: new Date(now + 10_000) }, () => undefined, first);
    service.schedule({ key: 'round-1', type: 'discussao', deadline: new Date(now + 10_000) }, () => undefined, second);
    service.cancel('round-1');
    vi.advanceTimersByTime(11_000);

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(service.remaining('round-1')).toBeNull();
    vi.useRealTimers();
  });
});
