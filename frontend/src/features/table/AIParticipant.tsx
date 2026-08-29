type Props = { enabled: boolean; status: 'idle' | 'voted' | 'unavailable' | 'error'; onRequest: () => void };

export function AIParticipant({ enabled, status, onRequest }: Props) {
  if (!enabled) return null;
  const label = status === 'unavailable' ? 'IA indisponível' : status === 'error' ? 'IA falhou' : status === 'voted' ? 'IA votou' : 'Pedir voto da IA';
  return <div className="ai-participant"><button className="secondary" type="button" onClick={onRequest} disabled={status === 'voted'}>🤖 {label}</button>{status === 'unavailable' && <small>Configure `LLM_API_KEY` e um endpoint compatível.</small>}{status === 'error' && <small>Sem voto automático. Continue manualmente.</small>}</div>;
}
