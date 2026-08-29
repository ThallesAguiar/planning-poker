import { Injectable, Logger } from '@nestjs/common';

const SECRET_KEYS = new Set(['password', 'passwordHash', 'token', 'authorization', 'apiKey', 'LLM_API_KEY']);

@Injectable()
export class CorrelationLogger {
  private readonly logger = new Logger('PlanningPoker');

  redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET_KEYS.has(key) || SECRET_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : this.redact(item)]));
  }

  event(event: string, correlationId: string, payload?: unknown) {
    this.logger.debug(JSON.stringify({ event, correlationId, payload: this.redact(payload) }));
  }
}
