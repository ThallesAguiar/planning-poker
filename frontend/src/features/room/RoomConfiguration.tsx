import { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/app-store';
import { configureRoom, useSelf } from '../../features/table/room-actions';

function NumberField({ label, value, suffix, onChange }: { label: string; value: number; suffix?: string; onChange: (next: number) => void }) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 1)}
      />
      {suffix && <small>{suffix}</small>}
    </label>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="settings-toggle config-toggle">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function RoomConfiguration({ onClose }: { onClose: () => void }) {
  const state = useAppStore((s) => s.state);
  const { isPO } = useSelf();
  const config = state?.config;
  const [reflexao, setReflexao] = useState(config?.tempoReflexaoSegundos ?? 120);
  const [discussao, setDiscussao] = useState(config?.tempoDiscussaoSegundos ?? 300);
  const [maxPessoas, setMaxPessoas] = useState(config?.maxParticipantes ?? 12);
  const [ia, setIa] = useState(config?.permiteParticipantesIA ?? false);
  const [anonimo, setAnonimo] = useState(config?.votoAnonimo ?? false);
  const [automatic, setAutomatic] = useState(config?.revelacaoAutomatica ?? false);
  const [criterio, setCriterio] = useState(config?.criterioConsenso ?? 'decisao_po');

  useEffect(() => {
    if (!config) return;
    setReflexao(config.tempoReflexaoSegundos);
    setDiscussao(config.tempoDiscussaoSegundos);
    setMaxPessoas(config.maxParticipantes);
    setIa(config.permiteParticipantesIA);
    setAnonimo(config.votoAnonimo);
    setAutomatic(config.revelacaoAutomatica);
    setCriterio(config.criterioConsenso);
  }, [config, state?.roomId, state?.code]);

  if (!isPO) return null;

  const phase = state?.phase;
  const locked = phase !== 'lobby' && phase !== undefined;

  const save = () => {
    const patch: Record<string, unknown> = {};
    if (reflexao !== config?.tempoReflexaoSegundos) patch.tempoReflexaoSegundos = reflexao;
    if (discussao !== config?.tempoDiscussaoSegundos) patch.tempoDiscussaoSegundos = discussao;
    if (maxPessoas !== config?.maxParticipantes) patch.maxParticipantes = maxPessoas;
    if (ia !== config?.permiteParticipantesIA) patch.permiteParticipantesIA = ia;
    if (anonimo !== config?.votoAnonimo) patch.votoAnonimo = anonimo;
    if (automatic !== config?.revelacaoAutomatica) patch.revelacaoAutomatica = automatic;
    if (criterio !== config?.criterioConsenso) patch.criterioConsenso = criterio;
    if (Object.keys(patch).length > 0) configureRoom(patch);
    onClose();
  };

  return (
    <div className="config-overlay" onClick={onClose}>
      <section className="config-panel" onClick={(event) => event.stopPropagation()}>
        <div className="settings-title">
          <h3>Configuracao da sala</h3>
          <button type="button" className="close-config" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        {locked && <p className="config-notice">Sala em andamento: a configuracao so vale antes de iniciar a rodada.</p>}
        <NumberField label="Tempo de reflexao (segundos)" value={reflexao} onChange={setReflexao} />
        <NumberField label="Tempo de discussao (segundos)" value={discussao} onChange={setDiscussao} />
        <NumberField label="Limite de participantes" value={maxPessoas} onChange={setMaxPessoas} />
        <label>
          Regra de consenso
          <select value={criterio} onChange={(e) => setCriterio(e.target.value as never)} disabled={locked}>
            <option value="decisao_po">Decisao do PO</option>
            <option value="unanime">Consenso unanim</option>
            <option value="media">Media</option>
            <option value="mediana">Mediana</option>
          </select>
        </label>
        <ToggleField label="Participante IA" checked={ia} onChange={setIa} />
        <ToggleField label="Voto anonimo" checked={anonimo} onChange={setAnonimo} />
        <ToggleField label="Revelacao automatica" checked={automatic} onChange={setAutomatic} />
        <button className="primary" type="button" onClick={save} disabled={locked}>
          Salvar configuracao
        </button>
      </section>
    </div>
  );
}