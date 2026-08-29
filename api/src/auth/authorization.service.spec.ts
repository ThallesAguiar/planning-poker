import { describe, expect, it } from 'vitest';
import { AuthorizationService } from './authorization.service.js';

describe('AuthorizationService', () => {
  const service = new AuthorizationService();

  it('allows only room owner to control PO actions', () => {
    expect(service.canControlRoom('owner', 'PO', 'owner')).toBe(true);
    expect(service.canControlRoom('member', 'PO', 'owner')).toBe(false);
  });

  it('blocks observers from voting and limits report export', () => {
    expect(service.canVote('Observador', 'votacao')).toBe(false);
    expect(service.canVote('Dev', 'votacao')).toBe(true);
    expect(service.canExportReport('ScrumMaster')).toBe(false);
    expect(service.canExportReport('ScrumMaster', true)).toBe(true);
  });
});
