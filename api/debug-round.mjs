import { vi } from 'vitest';
import { RoundService } from './src/realtime/round.service.js';
import { TimerService } from './src/realtime/timer.service.js';
import { defaultConfig } from './src/realtime/room.types.js';

const participants = [
  { id: 'p1', userId: 'u1', name: 'Ana', avatar: 's', role: 'PO', isAI: false, connected: true, hasVoted: false, status: 'ativo' },
  { id: 'p2', userId: 'u2', name: 'Bia', avatar: 'h', role: 'Dev', isAI: false, connected: true, hasVoted: false, status: 'ativo' },
];
const state = {
  roomId: 'C', dbRoomId: 'r1', name: 'S', code: 'C', status: 'aberta', visibility: 'PUBLIC', ownerId: 'p1',
  config: { ...defaultConfig, tempoReflexaoSegundos: 1 }, participants, stories: [{ id: 's1', title: 'A', description: '', order: 1, status: 'pendente', rounds: 0 }],
  phase: 'lobby', votes: [], remainingSeconds: null, timerType: null, messages: [],
};
const prisma = {
  story: { create: async (a)=>({ id: 'x', rounds:0, ...a.data }), update: async (a)=>a.data },
  voteRound: { create: async (a)=>({ id: `r-${a.data.number}`, ...a.data }), update: async (a)=>a.data },
  vote: { upsert: async ()=>({}), updateMany: async ()=>({}) },
  room: { update: async ()=>({}) },
};
vi.useFakeTimers();
const round = new RoundService(prisma, new TimerService());
const events = [];
round.setEmitter({ to: (r,e,p)=>events.push([e,p]), broadcast: (s)=>{ console.log('BROADCAST phase=', s.phase, 'votes=', JSON.stringify(s.votes)); } });
await round.present(state, 's1');
console.log('after present phase', state.phase);
await round.castVote(state, state.participants[0], 's1', 5);
await round.castVote(state, state.participants[1], 's1', 6);
console.log('votes', JSON.stringify(state.votes));
await vi.advanceTimersByTimeAsync(1500);
console.log('after advance phase', state.phase);
console.log('events', events.map(e=>e[0]).join(','));
process.exit(0);
