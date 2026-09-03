import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../stores/app-store';
import { StatusBar } from './StatusBar';
import { StoryPanel } from './StoryPanel';
import { ParticipantsPanel } from './ParticipantsPanel';
import { Felt } from './Felt';
import { Hand } from './Hand';
import { ChatPanel } from './ChatPanel';
import { RoomConfiguration } from '../room/RoomConfiguration';
import { useSelf } from './room-actions';

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function TableScreen({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const [configOpen, setConfigOpen] = useState(false);
  const { state, currentStory, isPO } = useSelf();
  const roomError = useAppStore((s) => s.roomError);
  const clearError = useAppStore((s) => s.setRoomError);
  const config = state?.config;
  const phase = state?.phase;

  const generateReport = () => {
    if (!state) return;
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/rooms/${state.code}/report`, {
      method: 'POST',
    })
      .then((response) => response.json())
      .then((report) => navigate(`/report/${report.id}`))
      .catch(() => undefined);
  };

  return (
    <main className="app-shell">
      <StatusBar
        onLogout={onLogout}
        onOpenSettings={() => {
          if (isPO) setConfigOpen(true);
        }}
      />

      {roomError && (
        <div className="room-error-toast" role="alert" onClick={() => clearError(null)}>
          <span aria-hidden="true">!</span>
          <p>{roomError.message}</p>
          <button type="button" aria-label="Fechar erro" onClick={() => clearError(null)}>
            ×
          </button>
        </div>
      )}

      {configOpen && <RoomConfiguration onClose={() => setConfigOpen(false)} />}

      <div className="workspace">
        <aside className="sidebar left">
          <div className="side-heading">
            <span>Sua mesa</span>
            <b>{state?.code ?? ''}</b>
          </div>
          <ParticipantsPanel />
          <StoryPanel />
          <div className="rules">
            <h3>Regras da sala</h3>
            <p>
              <b>Deck</b>: {config?.deckValues?.map((v) => String(v)).join(' · ') ?? '-'}
              <br />
              Reflexao: {config ? formatSeconds(config.tempoReflexaoSegundos) : '2:00'}
              <br />
              Discussao: {config ? formatSeconds(config.tempoDiscussaoSegundos) : '5:00'}
              <br />
              Voto anonimo: {config?.votoAnonimo ? 'sim' : 'nao'} · IA: {config?.permiteParticipantesIA ? 'sim' : 'nao'}
              <br />
              Revelacao automatica: {config?.revelacaoAutomatica ? 'sim' : 'nao'}
            </p>
            {isPO && (
              <button type="button" className="config-open-link" onClick={() => setConfigOpen(true)}>
                ⚙ Configurar sala
              </button>
            )}
            {phase === 'finalizada' && <p className="room-done">Sala encerrada. Gere o relatorio abaixo.</p>}
          </div>
          <button className="report-link" onClick={generateReport}>
            ▣ Gerar relatorio
          </button>
        </aside>

        <section className="table-area">
          <div className="story-header">
            <div>
              <small>HISTORIA ATUAL</small>
              <h2>{currentStory?.title ?? 'Aguardando proxima historia'}</h2>
              <p>{currentStory?.description ?? 'O PO pode iniciar uma historia para comecar a rodada.'}</p>
              {currentStory && currentStory.status !== 'pendente' && (
                <p className="story-inline-status">Status: {currentStory.status.replace(/_/g, ' ')}</p>
              )}
            </div>
            {state?.remainingSeconds !== null && state?.remainingSeconds !== undefined && phase !== 'lobby' && (
              <div className="timer">
                <small>{state?.timerType === 'discussao' ? 'TEMPO DE DISCUSSAO' : 'TEMPO DE REFLEXAO'}</small>
                <strong>{formatSeconds(state.remainingSeconds)}</strong>
              </div>
            )}
          </div>

          <Felt />

          <Hand />
        </section>

        <ChatPanel />
      </div>
    </main>
  );
}