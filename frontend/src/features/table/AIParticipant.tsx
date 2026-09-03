import type { AiStatus } from '../../stores/app-store';

type Props = { enabled: boolean; status: AiStatus; onRequest: () => void };

const LABELS: Record<AiStatus, string> = {
  idle: 'Pedir voto da IA',
  voting: 'IA votando...',
  voted: 'IA votou',
  unavailable: 'IA indisponível',
  error: 'IA falhou',
};

export function AIParticipant({ enabled, status, onRequest }: Props) {
  if (!enabled) return null;
  const busy = status === 'voting' || status === 'voted';
  return (
    <div className="ai-participant">
      <button className="secondary" type="button" onClick={onRequest} disabled={busy}>
        🤖 {LABELS[status] ?? 'IA'}
      </button>
      {(status === 'unavailable' || status === 'error') && (
        <small>
          {status === 'unavailable'
            ? 'Configure `LLM_API_KEY` e um endpoint compativel.'
            : 'Sem voto automatico. Continue manualmente.'}
        </small>
      )}
    </div>
  );
}