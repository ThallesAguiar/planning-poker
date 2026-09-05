export const ROOM_NAMESPACE = '/room' as const;

export type RoomStatus = 'aberta' | 'em_andamento' | 'encerrada';
export type RoomVisibility = 'PUBLIC' | 'PRIVATE';
export type ParticipantRole = 'PO' | 'Dev' | 'QA' | 'ScrumMaster' | 'Observador' | 'IA_Agente';
export type ParticipantStatus = 'ativo' | 'inativo';
export type StoryStatus = 'pendente' | 'em_votacao' | 'em_discussao' | 'estimada' | 'pulada';
export type VoteValue = number | 'café' | '?';
export type TimerType = 'reflexao' | 'discussao';
export type RoomPhase = 'lobby' | 'votacao' | 'discussao' | 'revelada' | 'finalizada';
export type ConsensusCriterion = 'unanime' | 'media' | 'mediana' | 'decisao_po';
export type AuthErrorCode = 'EMAIL_ALREADY_EXISTS' | 'INVALID_CREDENTIALS' | 'UNAUTHENTICATED' | 'INVALID_INPUT';
export type RoomErrorCode = 'ROOM_NOT_FOUND' | 'PASSWORD_REQUIRED' | 'INVALID_PASSWORD' | 'FORBIDDEN' | 'INVALID_PHASE' | 'INVALID_VOTE' | 'ROOM_FULL' | 'AI_UNAVAILABLE' | 'INVALID_PROFILE_UPDATE' | 'INVALID_ROLE_REQUEST' | 'PROFILE_REQUEST_NOT_FOUND' | 'REMOVED' | 'NOT_PARTICIPANT' | 'INVALID_CONFIG';
export const ROOM_ERROR_CODES: readonly RoomErrorCode[] = ['ROOM_NOT_FOUND', 'PASSWORD_REQUIRED', 'INVALID_PASSWORD', 'FORBIDDEN', 'INVALID_PHASE', 'INVALID_VOTE', 'ROOM_FULL', 'AI_UNAVAILABLE', 'INVALID_PROFILE_UPDATE', 'INVALID_ROLE_REQUEST', 'PROFILE_REQUEST_NOT_FOUND', 'REMOVED', 'NOT_PARTICIPANT', 'INVALID_CONFIG'];

export type RoomConfig = {
  deckType: 'fibonacci' | 'fibonacci_modificado' | 't_shirt' | 'custom';
  deckValues: VoteValue[];
  tempoReflexaoSegundos: number;
  tempoDiscussaoSegundos: number;
  permiteParticipantesIA: boolean;
  maxParticipantes: number;
  votoAnonimo: boolean;
  revelacaoAutomatica: boolean;
  criterioConsenso: ConsensusCriterion;
  papeisPermitidos?: ParticipantRole[];
  permiteRevotoIlimitado?: boolean;
}

export type AuthUser = { id: string; email: string; name: string; avatar: string };
export type AuthSessionResponse = { user: AuthUser; token: string; expiresAt: string };
export type AccountRoom = { id: string; code: string; name: string; status: RoomStatus; visibility: RoomVisibility; role: ParticipantRole; joinedAt: string; lastSeenAt: string; participantId: string; isOwner: boolean };
export type Participant = { id: string; userId?: string; name: string; avatar: string; role: ParticipantRole; isAI: boolean; connected: boolean; hasVoted: boolean; status?: ParticipantStatus };
export type RoomProfileUpdate = { name?: string; avatar?: string };
export type RoomRoleChangeRequest = { id: string; requesterParticipantId: string; requesterName?: string; currentRole: ParticipantRole; requestedRole: ParticipantRole; status: 'pending' | 'approved' | 'rejected' | 'cancelled'; createdAt: string; decidedAt?: string | null };
export type Story = { id: string; title: string; description: string; order: number; status: StoryStatus; finalValue?: VoteValue | null; criterion?: string | null; rounds: number };
export type ChatMessage = { id: string; author: string; role: ParticipantRole; text: string; type: 'commentario' | 'justificativa' | 'sistema'; createdAt: string };
export type VoteReveal = { participantId: string; participantName: string; value: VoteValue };
export type RoomState = { roomId: string; name: string; code: string; status: RoomStatus; visibility: RoomVisibility; ownerId?: string; config: RoomConfig; participants: Participant[]; stories: Story[]; currentStoryId?: string; roundId?: string; phase: RoomPhase; votes: VoteReveal[]; remainingSeconds: number | null; timerType?: TimerType | null; messages: ChatMessage[]; roleRequests: RoomRoleChangeRequest[] };
export type RoomErrorPayload = { code: RoomErrorCode; message: string };
export type ParticipantUpdateReason = 'joined' | 'left' | 'disconnected' | 'reconnected' | 'removed' | 'status' | 'role' | 'owner';
export type ParticipantUpdate = { participant: Participant; reason: ParticipantUpdateReason; ownerId?: string };
export type ReportSummary = { id: string; roomId: string; generatedAt: string; stories: Story[]; participation: { participantId: string; votes: number; comments: number }[]; achievements: string[]; exportUrls?: { csv?: string; pdf?: string } };
export type RestError = { code: RoomErrorCode; message: string; details?: Record<string, unknown> };

export type ClientToServerEvents = {
  'room:join': (payload: { roomId: string; name: string; avatar: string; role?: ParticipantRole; sessionId?: string; password?: string; token?: string }) => void;
  'room:leave': () => void;
  'room:profileUpdate': (payload: RoomProfileUpdate) => void;
  'room:roleChangeRequest': (payload: { role: ParticipantRole }) => void;
  'room:profileDecision': (payload: { requestId: string; decision: 'approved' | 'rejected' }) => void;
  'room:configure': (payload: { config: Partial<RoomConfig> }) => void;
  'room:transferOwner': (payload: { participantId: string }) => void;
  'room:removeParticipant': (payload: { participantId: string }) => void;
  'room:setParticipantStatus': (payload: { participantId: string; status: ParticipantStatus }) => void;
  'story:create': (payload: { title: string; description?: string }) => void;
  'story:present': (payload: { storyId: string }) => void;
  'vote:cast': (payload: { storyId: string; value: VoteValue }) => void;
  'vote:forceReveal': () => void;
  'vote:revote': () => void;
  'story:finalize': (payload: { value: VoteValue; criterion: RoomConfig['criterioConsenso'] }) => void;
  'story:skip': () => void;
  'chat:message': (payload: { text: string; type?: ChatMessage['type'] }) => void;
  'reaction:send': (payload: { value: string }) => void;
  'report:generate': () => void;
  'ai:requestVote': () => void;
};

export type ServerToClientEvents = {
  'room:state': (state: RoomState) => void;
  'room:error': (payload: RoomErrorPayload) => void;
  'room:participantUpdate': (payload: ParticipantUpdate) => void;
  'room:profileRequestPending': (payload: RoomRoleChangeRequest) => void;
  'room:profileDecision': (payload: { requestId: string; decision: 'approved' | 'rejected'; decidedAt: string }) => void;
  'room:kicked': (payload: { code?: RoomErrorCode; message?: string }) => void;
  'timer:tick': (payload: { type: TimerType; remainingSeconds: number }) => void;
  'timer:start': (payload: { type: TimerType; duracaoSegundos: number; deadline?: string }) => void;
  'vote:progress': (payload: { voted: number; total: number }) => void;
  'vote:reveal': (payload: { votes: VoteReveal[]; unanimous: boolean; average: number | null; min: number | null; max: number | null; mode?: VoteValue | null }) => void;
  'discussion:start': (payload: { remainingSeconds: number }) => void;
  'reaction:show': (payload: { value: string; participantId: string }) => void;
  'discussion:end': (payload: { storyId?: string; reason?: 'timeout' | 'manual' | 'revote' }) => void;
  'report:ready': (payload: { reportId: string; url?: string }) => void;
  'ai:status': (payload: { status: 'idle' | 'voting' | 'voted' | 'unavailable' | 'error'; message?: string }) => void;
};