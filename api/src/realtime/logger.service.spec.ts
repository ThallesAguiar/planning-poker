import { describe, expect, it } from 'vitest';
import { CorrelationLogger } from './logger.service.js';

describe('CorrelationLogger', () => {
  it('redacts credentials and room secrets recursively', () => {
    const logger = new CorrelationLogger();
    expect(logger.redact({ password: 'secret', nested: { token: 'jwt', name: 'Ada' } })).toEqual({ password: '[REDACTED]', nested: { token: '[REDACTED]', name: 'Ada' } });
  });
});
