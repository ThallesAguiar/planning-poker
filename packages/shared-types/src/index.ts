export const ROOM_NAMESPACE = '/room' as const;

export type RoomStatus = 'aberta' | 'em_andamento' | 'encerrada';
export type RoomVisibility = 'PUBLIC' | 'PRIVATE';
export type ParticipantRole = 'PO' | 'Dev' | 'QA' | 'Scrum Master' | 'Observador' | 'IA_Agente';
export type StoryStatus = 'pendente' | 'em_votacao' | 'em_discussao' | 'estimada' | 'pulada';
export type VoteValue = number | 'café' | '?';
export type TimerType = 'reflexao' | 'discussao';
export type ConsensusCriterion = 'unanime' | 'media' | 'mediana' | 'decisao_po';
export type RoomErrorCode = 'ROOM_NOT_FOUND' | 'PASSWORD_REQUIRED' | 'INVALID_PASSWORD' | 'FORBIDDEN' | 'INVALID_PHASE' | 'INVALID_VOTE' | 'ROOM_FULL' | 'AI_UNAVAILABLE';
export const ROOM_ERROR_CODES: readonly RoomErrorCode[] = ['ROOM_NOT_FOUND', 'PASSWORD_REQUIRED', 'INVALID_PASSWORD', 'FORBIDDEN', 'INVALID_PHASE', 'INVALID_VOTE', 'ROOM_FULL', 'AI_UNAVAILABLE'];

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

export type Participant = { id: string; userId?: string; name: string; avatar: string; role: ParticipantRole; isAI: boolean; connected: boolean; hasVoted: boolean };
export type Story = { id: string; title: string; description: string; order: number; status: StoryStatus; finalValue?: VoteValue | null; rounds: number };
export type ChatMessage = { id: string; author: string; role: ParticipantRole; text: string; type: 'commentario' | 'justificativa' | 'sistema'; createdAt: string };
export type VoteReveal = { participantId: string; participantName: string; value: VoteValue };
export type RoomState = { roomId: string; name: string; code: string; status: RoomStatus; visibility: RoomVisibility; ownerId?: string; config: RoomConfig; participants: Participant[]; stories: Story[]; currentStoryId?: string; phase: 'lobby' | 'votacao' | 'discussao' | 'revelada' | 'finalizada'; votes: VoteReveal[]; remainingSeconds: number | null; timerType?: TimerType | null; messages: ChatMessage[] };
export type ReportSummary = { id: string; roomId: string; generatedAt: string; stories: Story[]; participation: { participantId: string; votes: number; comments: number }[]; achievements: string[]; exportUrls?: { csv?: string; pdf?: string } };
export type RestError = { code: RoomErrorCode; message: string; details?: Record<string, unknown> };

export type ClientToServerEvents = {
  'room:join': (payload: { roomId: string; name: string; avatar: string; role?: ParticipantRole; sessionId?: string; password?: string; token?: string }) => void;
  'room:leave': () => void;
  'room:configure': (payload: { config: Partial<RoomConfig> }) => void;
  'room:transferOwner': (payload: { participantId: string }) => void;
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
  'room:error': (payload: { message: string }) => void;
  'room:participantUpdate': (state: RoomState) => void;
  'timer:tick': (payload: { type: TimerType; remainingSeconds: number }) => void;
  'timer:start': (payload: { type: TimerType; duracaoSegundos: number; deadline?: string }) => void;
  'vote:progress': (payload: { voted: number; total: number }) => void;
  'vote:reveal': (payload: { votes: VoteReveal[]; unanimous: boolean; average: number | null; min: number | null; max: number | null; mode?: VoteValue | null }) => void;
  'discussion:start': (payload: { remainingSeconds: number }) => void;
  'reaction:show': (payload: { value: string; participantId: string }) => void;
  'discussion:end': (payload: { storyId?: string; reason?: 'timeout' | 'manual' | 'revote' }) => void;
  'report:ready': (payload: { reportId: string; url?: string }) => void;
  'ai:status': (payload: { status: 'voted' | 'unavailable' | 'error'; message?: string }) => void;
};
