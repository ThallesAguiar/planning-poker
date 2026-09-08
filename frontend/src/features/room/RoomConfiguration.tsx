import { useEffect, useState } from 'react';
import { useAppStore } from '../../stores/app-store';
import { configureRoom, decideJoinRequest, decideRoleChange, listJoinRequests, removeParticipant, useSelf } from '../../features/table/room-actions';
import type { RoomVisibility } from '@planning-poker/shared-types';

function NumberField({ label, value, suffix, onChange, disabled }: { label: string; value: number; suffix?: string; onChange: (next: number) => void; disabled?: boolean }) {
  return (
    <label>
      {label}
      <input
        type="number"
        min={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 1)}
        disabled={disabled}
      />
      {suffix && <small>{suffix}</small>}
    </label>
  );
}

function ToggleField({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <label className="settings-toggle config-toggle">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
    </label>
  );
}

export function RoomConfiguration({ onClose }: { onClose: () => void }) {
  const state = useAppStore((s) => s.state);
  const joinRequests = useAppStore((s) => s.joinRequests);
  const roleRequests = useAppStore((s) => s.roleRequests);
  const { isPO } = useSelf();
  const config = state?.config;
  const [reflexao, setReflexao] = useState(config?.tempoReflexaoSegundos ?? 120);
  const [discussao, setDiscussao] = useState(config?.tempoDiscussaoSegundos ?? 300);
  const [maxPessoas, setMaxPessoas] = useState(config?.maxParticipantes ?? 12);
  const [ia, setIa] = useState(config?.permiteParticipantesIA ?? false);
  const [discute, setDiscute] = useState(config?.iaDiscute ?? false);
  const [anonimo, setAnonimo] = useState(config?.votoAnonimo ?? false);
  const [automatic, setAutomatic] = useState(config?.revelacaoAutomatica ?? false);
  const [requireJoinApproval, setRequireJoinApproval] = useState(config?.requireJoinApproval ?? false);
  const [criterio, setCriterio] = useState(config?.criterioConsenso ?? 'decisao_po');
  const [visibility, setVisibility] = useState<RoomVisibility>(state?.visibility ?? 'PUBLIC');
  const [password, setPassword] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;
    setReflexao(config.tempoReflexaoSegundos);
    setDiscussao(config.tempoDiscussaoSegundos);
    setMaxPessoas(config.maxParticipantes);
    setIa(config.permiteParticipantesIA);
    setDiscute(config.iaDiscute ?? false);
    setAnonimo(config.votoAnonimo);
    setAutomatic(config.revelacaoAutomatica);
    setRequireJoinApproval(config.requireJoinApproval ?? false);
    setCriterio(config.criterioConsenso);
    setVisibility(state?.visibility ?? 'PUBLIC');
    setPassword('');
    setSecurityError('');
    setConfirmRemove(null);
  }, [config, state?.roomId, state?.code]);

  useEffect(() => {
    if (!isPO) return;
    listJoinRequests();
    const timer = window.setInterval(listJoinRequests, 2500);
    return () => window.clearInterval(timer);
  }, [isPO]);

  if (!isPO) return null;

  const phase = state?.phase;
  const locked = phase !== 'lobby' && phase !== undefined;

  const save = () => {
    const patch: Record<string, unknown> = {};
    if (reflexao !== config?.tempoReflexaoSegundos) patch.tempoReflexaoSegundos = reflexao;
    if (discussao !== config?.tempoDiscussaoSegundos) patch.tempoDiscussaoSegundos = discussao;
    if (maxPessoas !== config?.maxParticipantes) patch.maxParticipantes = maxPessoas;
    if (ia !== config?.permiteParticipantesIA) patch.permiteParticipantesIA = ia;
    if (discute !== (config?.iaDiscute ?? false)) patch.iaDiscute = discute;
    if (anonimo !== config?.votoAnonimo) patch.votoAnonimo = anonimo;
    if (automatic !== config?.revelacaoAutomatica) patch.revelacaoAutomatica = automatic;
    if (requireJoinApproval !== (config?.requireJoinApproval ?? false)) patch.requireJoinApproval = requireJoinApproval;
    if (criterio !== config?.criterioConsenso) patch.criterioConsenso = criterio;
    if (visibility === 'PRIVATE' && state?.visibility !== 'PRIVATE' && password.trim().length < 4) {
      setSecurityError('Informe uma senha com pelo menos 4 caracteres para tornar a sala privada.');
      return;
    }
    if (visibility === 'PRIVATE' && password.trim().length > 0 && password.trim().length < 4) {
      setSecurityError('A senha precisa ter pelo menos 4 caracteres.');
      return;
    }
    const payload: Parameters<typeof configureRoom>[0] = {};
    if (Object.keys(patch).length > 0) payload.config = patch;
    if (visibility !== state?.visibility) payload.visibility = visibility;
    if (visibility === 'PRIVATE' && password.trim()) payload.password = password.trim();
    if (Object.keys(payload).length > 0) configureRoom(payload);
    onClose();
  };

  return (
    <div className="config-overlay" onClick={onClose}>
      <section className="config-panel ui-scrollbar" onClick={(event) => event.stopPropagation()}>
        <div className="settings-title">
          <h3>Configuracao da sala</h3>
          <button type="button" className="close-config" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>
        {locked && <p className="config-notice">Sala em andamento: privacidade e senha ainda podem ser alteradas. As demais configuracoes so valem antes de iniciar a rodada.</p>}
        <label>
          Acesso da sala
          <select value={visibility} onChange={(e) => { setVisibility(e.target.value as RoomVisibility); setSecurityError(''); }}>
            <option value="PUBLIC">Publica</option>
            <option value="PRIVATE">Privada</option>
          </select>
        </label>
        {visibility === 'PRIVATE' && (
          <label>
            Senha da sala
            <span className="config-password-field">
              <span className="config-password-icon" aria-hidden="true" />
              <input
                type="password"
                minLength={4}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setSecurityError('');
                }}
                placeholder={state?.visibility === 'PRIVATE' ? 'Deixe vazio para manter a senha atual' : 'Minimo 4 caracteres'}
              />
            </span>
            <small>{state?.visibility === 'PRIVATE' ? 'Preencha apenas se quiser trocar a senha.' : 'Novas entradas vao exigir esta senha.'}</small>
          </label>
        )}
        {securityError && <p className="config-notice" role="alert">{securityError}</p>}
        <NumberField label="Tempo de reflexao (segundos)" value={reflexao} onChange={setReflexao} disabled={locked} />
        <NumberField label="Tempo de discussao (segundos)" value={discussao} onChange={setDiscussao} disabled={locked} />
        <NumberField label="Limite de participantes" value={maxPessoas} onChange={setMaxPessoas} disabled={locked} />
        <label>
          Regra de consenso
          <select value={criterio} onChange={(e) => setCriterio(e.target.value as never)} disabled={locked}>
            <option value="decisao_po">Decisao do PO</option>
            <option value="unanime">Consenso unanim</option>
            <option value="media">Media</option>
            <option value="mediana">Mediana</option>
          </select>
        </label>
        <ToggleField label="Participante IA" checked={ia} onChange={setIa} disabled={locked} />
        <ToggleField label="IA discute" checked={discute} onChange={setDiscute} disabled={locked || !ia} />
        <ToggleField label="Voto anonimo" checked={anonimo} onChange={setAnonimo} disabled={locked} />
        <ToggleField label="Revelacao automatica" checked={automatic} onChange={setAutomatic} disabled={locked} />
        <ToggleField label="Exigir aprovacao para entrar" checked={requireJoinApproval} onChange={setRequireJoinApproval} />
        <div className="config-participants">
          <h4>Solicitacoes de papel</h4>
          {roleRequests.length === 0 && <p className="config-empty">Nenhuma solicitacao pendente.</p>}
          {roleRequests.map((request) => (
            <div className="config-participant-row" key={request.id}>
              <span className="person-avatar">?</span>
              <span>
                <b>{request.requesterName ?? 'Participante'}</b>
                <small>{request.currentRole} para {request.requestedRole}</small>
              </span>
              <span className="join-request-actions">
                <button type="button" className="moderate-link" onClick={() => decideRoleChange(request.id, 'approved')}>
                  Aprovar
                </button>
                <button type="button" className="moderate-link reject" onClick={() => decideRoleChange(request.id, 'rejected')}>
                  Recusar
                </button>
              </span>
            </div>
          ))}
        </div>
        <div className="config-participants">
          <h4>Pedidos de entrada</h4>
          {joinRequests.length === 0 && <p className="config-empty">Nenhum pedido pendente.</p>}
          {joinRequests.map((request) => (
            <div className="config-participant-row" key={request.id}>
              <span className="person-avatar">{request.avatar || '?'}</span>
              <span>
                <b>{request.name}</b>
                <small>{request.requestedRole} aguardando aprovacao</small>
              </span>
              <span className="join-request-actions">
                <button type="button" className="moderate-link" onClick={() => decideJoinRequest(request.id, 'approved')}>
                  Aprovar
                </button>
                <button type="button" className="moderate-link reject" onClick={() => decideJoinRequest(request.id, 'rejected')}>
                  Recusar
                </button>
              </span>
            </div>
          ))}
        </div>
        <div className="config-participants">
          <h4>Participantes</h4>
          {(state?.participants ?? []).map((person) => {
            const canRemove = person.id !== state?.ownerId;
            return (
              <div className="config-participant-row" key={person.id}>
                <span className="person-avatar">{person.avatar}</span>
                <span>
                  <b>{person.name}</b>
                  <small>{person.role}{person.connected ? ' online' : ' offline'}</small>
                </span>
                {canRemove && (
                  <button
                    type="button"
                    className="moderate-link reject"
                    onClick={() => {
                      if (confirmRemove === person.id) {
                        removeParticipant(person.id);
                        setConfirmRemove(null);
                      } else {
                        setConfirmRemove(person.id);
                      }
                    }}
                  >
                    {confirmRemove === person.id ? 'Confirmar?' : 'Remover'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <button className="primary" type="button" onClick={save}>
          Salvar configuracao
        </button>
      </section>
    </div>
  );
}
