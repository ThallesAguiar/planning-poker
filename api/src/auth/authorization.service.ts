import { Injectable } from '@nestjs/common';

export type AdministrativeRole = 'PO' | 'ScrumMaster';

@Injectable()
export class AuthorizationService {
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
