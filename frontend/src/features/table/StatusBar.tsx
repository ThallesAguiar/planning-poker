import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const state = useAppStore((s) => s.state);
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const account = useAppStore((s) => s.account);
  const { self, isPO } = useSelf();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 700) setMobileMenuOpen(false);
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <header className="topbar">
      <div className="wordmark">
        <span>PP</span> planning poker
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

      <button
        type="button"
        className="mobile-actions-toggle"
        aria-expanded={mobileMenuOpen}
        aria-controls="topbar-actions"
        onClick={() => setMobileMenuOpen((open) => !open)}
      >
        Menu
      </button>

      <div className={`top-actions ${mobileMenuOpen ? 'is-open' : ''}`} id="topbar-actions">
        <span className={`connection-dot ${connectionStatus}`} title={`Socket: ${connectionStatus}`} />
        {connectionStatus === 'reconnecting' && <small className="reconnecting-label">reconectando</small>}
        {isPO && (
          <button
            type="button"
            onClick={() => {
              onOpenSettings();
              setMobileMenuOpen(false);
            }}
            title="Configuracoes da sala"
          >
            Config
          </button>
        )}
        {account && (
          <button
            type="button"
            onClick={() => {
              navigate('/profile');
              setMobileMenuOpen(false);
            }}
          >
            Perfil
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            onLogout();
            setMobileMenuOpen(false);
          }}
        >
          Sair
        </button>
        <div className="user-avatar" title={self?.name ?? ''}>
          {self?.avatar ?? 'PP'}
        </div>
      </div>
    </header>
  );
}
