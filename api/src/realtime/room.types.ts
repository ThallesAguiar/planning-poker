import type {
  RoomConfig,
  RoomStatus,
  RoomVisibility,
  Participant,
  ParticipantStatus,
  Story,
  ChatMessage,
  VoteReveal,
  RoomPhase,
  RoomErrorCode,
  TimerType,
  VoteValue,
  RoomRoleChangeRequest,
} from '@planning-poker/shared-types';

export type InternalParticipant = Participant & { userId: string; status: ParticipantStatus };
export type InternalStory = Story;
export type InternalVote = VoteReveal;
export type InternalMessage = ChatMessage;

export type InternalRoomState = {
  roomId: string;
  dbRoomId: string;
  name: string;
  code: string;
  status: RoomStatus;
  visibility: RoomVisibility;
  passwordHash?: string | null;
  ownerId: string;
  config: RoomConfig;
  participants: InternalParticipant[];
  stories: InternalStory[];
  currentStoryId?: string;
  roundId?: string;
  phase: RoomPhase;
  votes: InternalVote[];
  remainingSeconds: number | null;
  timerType: TimerType | null;
  messages: InternalMessage[];
  roleRequests?: RoomRoleChangeRequest[];
  timer?: NodeJS.Timeout;
};

export type ActionResult = { error?: RoomErrorCode };

export const defaultConfig: RoomConfig = {
  deckType: 'fibonacci',
  deckValues: [1, 2, 3, 5, 8, 13, 20, 40, 100, 'café', '?'],
  tempoReflexaoSegundos: 120,
  tempoDiscussaoSegundos: 300,
  permiteParticipantesIA: false,
  maxParticipantes: 12,
  votoAnonimo: false,
  revelacaoAutomatica: false,
  criterioConsenso: 'decisao_po',
  papeisPermitidos: ['PO', 'Dev', 'QA', 'ScrumMaster', 'Observador', 'IA_Agente'],
};

export type RoundEmitter = {
  to(roomId: string, event: string, payload: unknown): void;
  broadcast(state: InternalRoomState): void;
};

export type { RoomConfig, RoomStatus, RoomVisibility, ParticipantStatus, Story, ChatMessage, VoteReveal, RoomPhase, TimerType, VoteValue };