import { socket } from '../../lib/socket';
import { useAppStore } from '../../stores/app-store';
import type { ConsensusCriterion, ParticipantRole, ParticipantStatus, VoteValue } from '@planning-poker/shared-types';

export function castVote(storyId: string, value: VoteValue, justification?: string) {
  useAppStore.getState().setRoomError(null);
  socket.emit('vote:cast', { storyId, value, justification });
}

export function forceReveal() {
  useAppStore.getState().setRoomError(null);
  socket.emit('vote:forceReveal');
}

export function revote() {
  useAppStore.getState().setRoomError(null);
  socket.emit('vote:revote');
}

export function finalizeStory(value: VoteValue, criterion: ConsensusCriterion) {
  useAppStore.getState().setRoomError(null);
  socket.emit('story:finalize', { value, criterion });
}

export function skipStory() {
  useAppStore.getState().setRoomError(null);
  socket.emit('story:skip');
}

export function requestAiVote() {
  useAppStore.getState().setAiStatus('voting');
  useAppStore.getState().setRoomError(null);
  socket.emit('ai:requestVote');
}

export function createStory(title: string, description: string) {
  useAppStore.getState().setRoomError(null);
  socket.emit('story:create', { title, description });
}

export function presentStory(storyId: string) {
  useAppStore.getState().setRoomError(null);
  socket.emit('story:present', { storyId });
}

export function sendChatMessage(text: string) {
  useAppStore.getState().setRoomError(null);
  socket.emit('chat:message', { text });
}

export function sendReaction(value: string) {
  useAppStore.getState().setRoomError(null);
  socket.emit('reaction:send', { value });
}

export function requestRoleChange(role: ParticipantRole) {
  useAppStore.getState().setRoomError(null);
  socket.emit('room:roleChangeRequest', { role });
}

export function decideRoleChange(requestId: string, decision: 'approved' | 'rejected') {
  useAppStore.getState().setRoomError(null);
  socket.emit('room:profileDecision', { requestId, decision });
}

export function configureRoom(patch: Record<string, unknown>) {
  useAppStore.getState().setRoomError(null);
  socket.emit('room:configure', { config: patch });
}

export function removeParticipant(participantId: string) {
  useAppStore.getState().setRoomError(null);
  socket.emit('room:removeParticipant', { participantId });
}

export function setParticipantStatus(participantId: string, status: ParticipantStatus) {
  useAppStore.getState().setRoomError(null);
  socket.emit('room:setParticipantStatus', { participantId, status });
}

export function transferOwner(participantId: string) {
  useAppStore.getState().setRoomError(null);
  socket.emit('room:transferOwner', { participantId });
}

export function useSelf() {
  const state = useAppStore((s) => s.state);
  const selfId = useAppStore((s) => s.selfId);
  const self = state?.participants?.find((participant) => participant.id === selfId) ?? null;
  const isOwner = Boolean(state && self && state.ownerId === self.id);
  const isPO = Boolean(isOwner && self?.role === 'PO');
  const isObserver = self?.role === 'Observador';
  const currentStory = state?.stories.find((story) => story.id === state.currentStoryId) ?? null;
  const eligible = state?.participants.filter(
    (participant) => participant.role !== 'Observador' && (participant.status ?? 'ativo') === 'ativo' && (participant.connected || participant.hasVoted),
  ) ?? [];
  const total = eligible.length;
  const voted = eligible.filter((participant) => participant.hasVoted).length;
  return {
    state,
    self,
    selfId,
    isPO,
    isOwner,
    isObserver,
    currentStory,
    votingCount: { total, voted },
    canVote: Boolean(state && state.phase === 'votacao' && state.roundId && self && self.role !== 'Observador' && (self.status ?? 'ativo') === 'ativo'),
    hasVoted: self?.hasVoted ?? false,
    canReveal: Boolean(isPO && state && state.phase === 'votacao' && (state.votes?.length ?? 0) > 0),
    phase: state?.phase ?? 'lobby',
  };
}