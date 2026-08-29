import { Injectable } from '@nestjs/common';

export type TimerDeadline = {
  key: string;
  type: 'reflexao' | 'discussao';
  deadline: Date;
};

type ScheduledTimer = TimerDeadline & { handle: NodeJS.Timeout };

@Injectable()
export class TimerService {
  private readonly timers = new Map<string, ScheduledTimer>();

  schedule(timer: TimerDeadline, onTick: (remainingSeconds: number) => void, onExpire: () => void | Promise<void>) {
    this.cancel(timer.key);
    const tick = () => {
      const remainingSeconds = Math.max(0, Math.ceil((timer.deadline.getTime() - Date.now()) / 1000));
      onTick(remainingSeconds);
      if (remainingSeconds === 0) {
        this.cancel(timer.key);
        void onExpire();
      }
    };
    const handle = setInterval(tick, 1000);
    this.timers.set(timer.key, { ...timer, handle });
    tick();
    return timer;
  }

  cancel(key: string) {
    const timer = this.timers.get(key);
    if (timer) clearInterval(timer.handle);
    this.timers.delete(key);
  }

  remaining(key: string) {
    const timer = this.timers.get(key);
    return timer ? Math.max(0, Math.ceil((timer.deadline.getTime() - Date.now()) / 1000)) : null;
  }

  get activeCount() {
    return this.timers.size;
  }
}
