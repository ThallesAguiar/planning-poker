import { Injectable } from '@nestjs/common';
import { SessionService } from './session.service.js';

export type AdministrativeRole = 'PO' | 'ScrumMaster';

@Injectable()
export class AuthorizationService {
  constructor(private readonly sessions?: SessionService) {}

  accountFromAuthorization(authorization?: string) {
    const [scheme, token] = authorization?.split(' ') ?? [];
    if (!this.sessions) return null;
    if (scheme !== 'Bearer' || !token) return null;
    try {
      return this.sessions.verifyAccount(token);
    } catch {
      return null;
    }
  }

  canControlRoom(participantId: string, participantRole: string, ownerId: string, role: AdministrativeRole = 'PO') {
    return participantId === ownerId && participantRole === role;
  }

  canVote(participantRole: string, phase: string) {
    return participantRole !== 'Observador' && phase === 'votacao';
  }

  canViewReport(isMember: boolean) {
    return isMember;
  }

  canExportReport(participantRole: string, scrumMasterAuthorized = false) {
    return participantRole === 'PO' || (participantRole === 'ScrumMaster' && scrumMasterAuthorized);
  }
}
