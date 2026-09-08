import type { AiStatus } from '../../stores/app-store';

type Props = { enabled: boolean; status: AiStatus; onRequest: () => void; mode?: 'vote' | 'discuss' };

const VOTE_LABELS: Record<AiStatus, string> = {
  idle: 'Pedir voto da IA',
  voting: 'IA votando...',
  voted: 'IA votou',
  discussing: '',
  discussed: '',
  unavailable: 'IA indisponível',
  error: 'IA falhou',
};

const DISCUSS_LABELS: Record<AiStatus, string> = {
  idle: '🤖 Resumir & sugerir',
  voting: '',
  voted: '',
  discussing: 'IA analisando...',
  discussed: 'IA analisou',
  unavailable: 'IA indisponível',
  error: 'IA falhou',
};

export function AIParticipant({ enabled, status, onRequest, mode = 'vote' }: Props) {
  if (!enabled) return null;
  const labels = mode === 'discuss' ? DISCUSS_LABELS : VOTE_LABELS;
  const busy = mode === 'discuss'
    ? status === 'discussing' || status === 'discussed'
    : status === 'voting' || status === 'voted';
  return (
    <div className="ai-participant">
      <button className="secondary" type="button" onClick={onRequest} disabled={busy}>
        {labels[status] ?? 'IA'}
      </button>
      {(status === 'unavailable' || status === 'error') && (
        <small>
          {status === 'unavailable'
            ? 'Configure `LLM_API_KEY` e um endpoint compatível.'
            : 'Sem voto automático. Continue manualmente.'}
        </small>
      )}
    </div>
  );
}
