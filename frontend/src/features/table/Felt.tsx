import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '../../stores/app-store';
import { AIParticipant } from './AIParticipant';
import { finalizeStory, forceReveal, requestAiVote, revote, sendReaction, skipStory, useSelf } from './room-actions';
import type { ConsensusCriterion } from '@planning-poker/shared-types';

const REACTIONS = ['👍', '🤔', '😅', '🔥'] as const;

function revealedValue(state: ReturnType<typeof useSelf>['state'], participantId: string) {
  const phase = state?.phase;
  if (phase !== 'revelada' && phase !== 'discussao') return null;
  return state?.votes.find((vote) => vote.participantId === participantId)?.value ?? null;
}

export function Felt() {
  const { state, selfId, isPO, currentStory, votingCount, canReveal, phase } = useSelf();
  const aiStatus = useAppStore((s) => s.aiStatus);
  const reactions = useAppStore((s) => s.reactions);
  const confetti = useAppStore((s) => s.confetti);
  const confettiKey = useAppStore((s) => s.confettiKey);
  const clearConfetti = useAppStore((s) => s.clearConfetti);
  const [finalizing, setFinalizing] = useState(false);
  const [reactionOpen, setReactionOpen] = useState(false);
  const reactionRef = useRef<HTMLDivElement>(null);
  const seats = (state?.participants ?? []).slice(0, 6);
  const revealed = phase === 'revelada' || phase === 'discussao';
  const divergent = phase === 'discussao';
  const aiEnabled = state?.config.permiteParticipantesIA ?? false;
  const finalValues = Array.from(new Set(state?.votes.map((vote) => String(vote.value)) ?? []));
  const [finalValue, setFinalValue] = useState<string>(finalValues[0] ?? '');
  const [criterion, setCriterion] = useState<ConsensusCriterion>(state?.config.criterioConsenso ?? 'decisao_po');

  useEffect(() => {
    if (finalValues.length > 0 && !finalValues.includes(finalValue)) setFinalValue(finalValues[0]);
  }, [finalValues, finalValue]);

  useEffect(() => {
    if (!reactionOpen) return;
    const onDown = (event: MouseEvent) => {
      if (reactionRef.current && !reactionRef.current.contains(event.target as Node)) setReactionOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [reactionOpen]);

  useEffect(() => {
    if (!confetti) return;
    const timer = window.setTimeout(clearConfetti, 3600);
    return () => window.clearTimeout(timer);
  }, [confetti, confettiKey, clearConfetti]);

  return (
    <div className="felt">
      <div className="felt-ring" />
      <div className="table-label">
        <span>RODADA DE VOTACAO</span>
        <strong>
          {!currentStory
            ? 'Aguardando historia'
            : revealed
              ? divergent
                ? 'Divergencia — fase de discussao'
              : 'Cartas reveladas'
              : phase === 'votacao'
                ? 'Escolha sua carta'
                : 'Lobby'}
        </strong>
      </div>

      <div className="players-around">
        {seats.map((person, index) => {
          const value = revealedValue(state, person.id);
          const showFaceDown = person.hasVoted && !revealed;
          const isSelf = person.id === selfId;
          return (
            <motion.div
              className={`seat seat-${index} ${person.hasVoted ? 'has-voted' : ''} ${inativo(person) ? 'is-offline' : ''}`}
              animate={{ y: person.hasVoted && !revealed ? -8 : 0 }}
              key={person.id}
            >
              <span className="seat-avatar">{person.avatar}</span>
              <small>
                {person.name}
                {isSelf ? ' (voce)' : ''}
              </small>
              <AnimatePresence mode="wait">
                {showFaceDown && (
                  <motion.span
                    key="down"
                    className="face-down"
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: -90, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                  >
                    ?
                  </motion.span>
                )}
                {revealed && value !== null && (
                  <motion.span
                    key={`up-${String(value)}`}
                    className={`face-up ${divergent && isOutlier(state, person.id) ? 'outlier' : ''}`}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: -90, opacity: 0 }}
                    transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.15) }}
                  >
                    {value}
                  </motion.span>
                )}
              </AnimatePresence>
              {!person.connected && <i className="seat-offline-mark">offline</i>}
            </motion.div>
          );
        })}
      </div>

      {/* Reacoes flutuantes (emitidas por reaction:show) */}
      <div className="reaction-layer" aria-hidden="true">
        <AnimatePresence>
          {reactions.map((reaction) => (
            <motion.span
              key={reaction.id}
              className="reaction-bubble"
              style={{ left: `${reaction.x}%`, top: `${reaction.y}%` }}
              initial={{ y: 12, opacity: 0, scale: 0.75 }}
              animate={{ y: -22, opacity: 1, scale: 1 }}
              exit={{ y: -52, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            >
              {reaction.value}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      {/* Confete em consenso (vote:reveal unanimous) */}
      <AnimatePresence>
        {confetti && (
          <motion.div
            key={`confetti-${confettiKey}`}
            className="confetti-layer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            aria-hidden="true"
          >
            {Array.from({ length: 32 }).map((_, index) => {
              const angle = (index / 32) * 360;
              const radius = 58 + Math.random() * 38;
              const x = Math.cos((angle * Math.PI) / 180) * radius;
              const y = Math.sin((angle * Math.PI) / 180) * radius;
              const hue = (index * 11) % 360;
              return (
                <motion.span
                  key={index}
                  className="confetti-piece"
                  style={{
                    background: `hsl(${hue} 92% 62%)`,
                    left: '50%',
                    top: '50%',
                  }}
                  initial={{ x: 0, y: 0, rotate: 0, opacity: 0 }}
                  animate={{ x, y, rotate: angle * 1.5 + Math.random() * 80, opacity: [0, 1, 0.7] }}
                  transition={{ duration: 1.1, delay: index * 0.01, ease: 'easeOut' }}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="progress">
        <div>
          <span>
            {votingCount.voted} de {votingCount.total} jogaram
          </span>
          <b>{votingCount.total ? Math.round((votingCount.voted / votingCount.total) * 100) : 0}%</b>
        </div>
        <div className="progress-track">
          <motion.i animate={{ width: `${votingCount.total ? Math.round((votingCount.voted / votingCount.total) * 100) : 0}%` }} />
        </div>
      </div>

      <div className="table-actions">
        {isPO && (
          <>
            <button className="secondary" type="button" disabled={!canReveal && !revealed} onClick={forceReveal}>
              Revelar cartas
            </button>
            {(phase === 'discussao' || phase === 'revelada') && (
              <>
                <button className="secondary" type="button" onClick={() => void revote()}>
                  Revotar
                </button>
                <div className="finalize-wrap">
                  <button className="primary" type="button" onClick={() => setFinalizing((v) => !v)}>
                    Finalizar
                  </button>
                  {finalizing && (
                    <div className="finalize-popover">
                      <label>
                        Valor final
                        <select value={finalValue} onChange={(e) => setFinalValue(e.target.value)}>
                          {finalValues.map((value) => (
                            <option value={value} key={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Criterio
                        <select value={criterion} onChange={(e) => setCriterion(e.target.value as ConsensusCriterion)}>
                          <option value="decisao_po">Decisao do PO</option>
                          <option value="unanime">Consenso unanim</option>
                          <option value="media">Media</option>
                          <option value="mediana">Mediana</option>
                        </select>
                      </label>
                      <button
                        className="primary"
                        type="button"
                        disabled={finalValues.length === 0}
                        onClick={() => {
                          const numeric = Number(finalValue);
                          const value = Number.isNaN(numeric) ? (finalValue as never) : numeric;
                          finalizeStory(value, criterion);
                          setFinalizing(false);
                        }}
                      >
                        Confirmar estimativa
                      </button>
                    </div>
                  )}
                </div>
                <button className="secondary" type="button" onClick={() => void skipStory()}>
                  Pular historia
                </button>
              </>
            )}
            {aiEnabled && phase === 'votacao' && (
              <AIParticipant enabled={aiEnabled} status={aiStatus} onRequest={requestAiVote} />
            )}
          </>
        )}
        {!isPO && (
          <span className="admin-hint">
            {phase === 'votacao' ? 'Vote quando estiver pronto. O PO conduz a revelacao.' : 'Aguardando acao do PO.'}
          </span>
        )}
        <div className="reaction-bar" ref={reactionRef}>
          <button type="button" className="reaction-trigger" onClick={() => setReactionOpen((v) => !v)} title="Enviar reacao">
            Reagir
          </button>
          {reactionOpen && (
            <div className="reaction-palette" role="dialog" aria-label="Reacoes">
              {REACTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className="reaction-palette-item"
                  onClick={() => {
                    sendReaction(value);
                    setReactionOpen(false);
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function inativo(person: { status?: string; connected: boolean }) {
  return (person.status ?? 'ativo') === 'inativo' || !person.connected;
}

function isOutlier(state: ReturnType<typeof useSelf>['state'], participantId: string) {
  const votes = state?.votes ?? [];
  if (!votes.length) return false;
  const values = votes.map((vote) => String(vote.value));
  const mostCommon = values
    .slice()
    .sort((a, b) => values.filter((v) => v === a).length - values.filter((v) => v === b).length)
    .at(-1);
  const current = votes.find((vote) => vote.participantId === participantId);
  return Boolean(current && mostCommon && String(current.value) !== mostCommon);
}
