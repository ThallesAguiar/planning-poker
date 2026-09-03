import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../stores/app-store';
import { AIParticipant } from './AIParticipant';
import { finalizeStory, forceReveal, requestAiVote, revote, skipStory, useSelf } from './room-actions';
import type { ConsensusCriterion } from '@planning-poker/shared-types';

function revealedValue(state: ReturnType<typeof useSelf>['state'], participantId: string) {
  const phase = state?.phase;
  if (phase !== 'revelada' && phase !== 'discussao') return null;
  return state?.votes.find((vote) => vote.participantId === participantId)?.value ?? null;
}

export function Felt() {
  const { state, selfId, isPO, currentStory, votingCount, canReveal, phase } = useSelf();
  const aiStatus = useAppStore((s) => s.aiStatus);
  const [finalizing, setFinalizing] = useState(false);
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
              {showFaceDown && <span className="face-down">?</span>}
              {revealed && value !== null && <span className={`face-up ${divergent && isOutlier(state, person.id) ? 'outlier' : ''}`}>{value}</span>}
              {!person.connected && <i className="seat-offline-mark">offline</i>}
            </motion.div>
          );
        })}
      </div>

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