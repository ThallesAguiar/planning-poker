import { useAppStore } from '../../stores/app-store';
import { useSelf } from './room-actions';

const PHASE_LABEL: Record<string, string> = {
  lobby: 'Aguardando historia',
  votacao: 'Votacao',
  discussao: 'Discussao',
  revelada: 'Revelacao',
  finalizada: 'Encerrada',
};

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function StatusBar({ onLogout, onOpenSettings }: { onLogout: () => void; onOpenSettings: () => void }) {
  const state = useAppStore((s) => s.state);
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const self = useSelf().self;

  return (
    <header className="topbar">
      <div className="wordmark">
        <span>♠</span> planning poker
      </div>
      <div className="session-title">
        <small>SESSAO AO VIVO</small>
        <strong>{state?.name ?? 'Sala'}</strong>
      </div>

      <div className="phase-pill">
        <small>Fase: {PHASE_LABEL[state?.phase ?? 'lobby'] ?? state?.phase}</small>
        <strong>
          {state?.remainingSeconds !== null && state?.remainingSeconds !== undefined && state.phase !== 'finalizada'
            ? formatSeconds(state.remainingSeconds)
            : '—'}
        </strong>
        {state?.timerType && <i className="timer-kind">{state.timerType === 'reflexao' ? 'Reflexao' : 'Discussao'}</i>}
      </div>

      <div className="top-actions">
        <span className={`connection-dot ${connectionStatus}`} title={`Socket: ${connectionStatus}`} />
        {connectionStatus === 'reconnecting' && <small className="reconnecting-label">reconectando</small>}
        <button type="button" onClick={onOpenSettings} title="Configuracoes da sala">
          ⚙
        </button>
        <button type="button" onClick={onLogout}>
          Sair
        </button>
        <div className="user-avatar" title={self?.name ?? ''}>
          {self?.avatar ?? '♠'}
        </div>
      </div>
    </header>
  );
}