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

type ReportSections = { withChat?: boolean; withVotes?: boolean; withRoomNotes?: boolean; withInsights?: boolean };

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function TableScreen({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const [configOpen, setConfigOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSections, setReportSections] = useState<ReportSections>({ withChat: true, withVotes: true, withRoomNotes: true, withInsights: true });
  const { state, currentStory, isPO } = useSelf();
  const roomError = useAppStore((s) => s.roomError);
  const clearError = useAppStore((s) => s.setRoomError);
  const config = state?.config;
  const phase = state?.phase;

  const generateReport = () => {
    if (!state) return;
    // O controller REST espera o ReportOptions direto no body (sem wrapper 'sections');
    // omite os campos que ficam ativos por padrao (true), enviando apenas o que for desativado.
    const options: ReportSections = {};
    if (!reportSections.withChat) options.withChat = false;
    if (!reportSections.withVotes) options.withVotes = false;
    if (!reportSections.withRoomNotes) options.withRoomNotes = false;
    if (!reportSections.withInsights) options.withInsights = false;
    const body = Object.keys(options).length > 0 ? JSON.stringify(options) : undefined;
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/rooms/${state.code}/report`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body,
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
          <div className="report-trigger-wrap">
            <button className="report-link" onClick={() => setReportOpen((v) => !v)}>
              ▣ Gerar relatorio
            </button>
            {reportOpen && (
              <div className="report-options-panel" role="dialog" aria-label="Opcoes do relatorio">
                <strong>O que incluir</strong>
                {([
                  ['withChat', 'Conversas das historias'],
                  ['withVotes', 'Votos por rodada'],
                  ['withRoomNotes', 'Anotacoes da mesa'],
                  ['withInsights', 'Sintese e ideias de tasks'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="report-option-toggle">
                    <input
                      type="checkbox"
                      checked={reportSections[key]}
                      onChange={(event) => setReportSections((prev) => ({ ...prev, [key]: event.target.checked }))}
                    />
                    <span>{label}</span>
                  </label>
                ))}
                <button className="primary" type="button" onClick={generateReport}>
                  Gerar
                </button>
              </div>
            )}
          </div>
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