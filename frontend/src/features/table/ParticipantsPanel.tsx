import { useEffect, useRef, useState } from 'react';
import { decideRoleChange, removeParticipant, requestRoleChange, setParticipantStatus, transferOwner, useSelf } from './room-actions';
import { useAppStore } from '../../stores/app-store';
import type { ParticipantRole } from '@planning-poker/shared-types';

const REQUESTABLE_ROLES: ParticipantRole[] = ['Dev', 'QA', 'ScrumMaster', 'Observador'];

function presenceLabel(participant: { connected: boolean; status?: string; role: string }) {
  if ((participant.status ?? 'ativo') === 'inativo') return 'Inativo';
  if (!participant.connected) return 'Offline';
  return participant.role;
}

export function ParticipantsPanel() {
  const { state, selfId, isPO } = useSelf();
  const roleRequests = useAppStore((s) => s.roleRequests);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const roleRef = useRef<HTMLDivElement>(null);
  const participants = state?.participants ?? [];
  const pending = roleRequests.filter((request) => request.status === 'pending');
  const selfPending = pending.find((request) => request.requesterParticipantId === selfId);
  const allowed = state?.config.papeisPermitidos ?? REQUESTABLE_ROLES;

  useEffect(() => {
    if (!roleOpen) return;
    const onDown = (event: MouseEvent) => {
      if (roleRef.current && !roleRef.current.contains(event.target as Node)) setRoleOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [roleOpen]);

  const ownerLabel = (participantId: string) => (state?.ownerId === participantId ? ' (PO)' : '');

  return (
    <section className="people participant-panel">
      <h3>
        Participantes <small>{participants.length}</small>
      </h3>

      {isPO && pending.length > 0 && (
        <div className="role-requests">
          <span className="role-requests-title">
            Solicitacoes de papel <b>{pending.length}</b>
          </span>
          {pending.map((request) => (
            <div className="role-request" key={request.id}>
              <span className="role-request-info">
                <b>{request.requesterName ?? 'Participante'}</b>
                <small>
                  {request.currentRole} &rarr; {request.requestedRole}
                </small>
              </span>
              <button
                type="button"
                className="moderate-link"
                onClick={() => decideRoleChange(request.id, 'approved')}
                title="Aprovar mudanca de papel"
              >
                Aprovar
              </button>
              <button
                type="button"
                className="moderate-link reject"
                onClick={() => decideRoleChange(request.id, 'rejected')}
                title="Recusar mudanca de papel"
              >
                Recusar
              </button>
            </div>
          ))}
        </div>
      )}

      {!isPO && (
        <div className="role-ask" ref={roleRef}>
          {selfPending ? (
            <small className="role-ask-pending">Solicitacao de papel pendente ({selfPending.requestedRole})</small>
          ) : (
            <button type="button" className="moderate-link role-ask-trigger" onClick={() => setRoleOpen((v) => !v)}>
              Solicitar papel
            </button>
          )}
          {roleOpen && !selfPending && (
            <div className="role-palette" role="dialog" aria-label="Escolha um papel">
              {allowed.map((role) => (
                <button
                  key={role}
                  type="button"
                  className="reaction-palette-item"
                  onClick={() => {
                    requestRoleChange(role);
                    setRoleOpen(false);
                  }}
                >
                  {role}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {participants.map((person) => {
        const isSelf = person.id === selfId;
        const offline = !person.connected || (person.status ?? 'ativo') === 'inativo';
        return (
          <div className="person" key={person.id}>
            <span className="person-avatar">{person.avatar}</span>
            <span className="person-body">
              <b>
                {person.name}
                {ownerLabel(person.id)}
                {person.isAI ? ' (IA)' : ''}
              </b>
              <small>
                {presenceLabel(person)}
                {isSelf ? ' · Voce' : ''}
                {!isSelf && isPO && (
                  <span className="moderate-actions">
                    {person.id !== state?.ownerId && (
                      <button
                        type="button"
                        className="moderate-link"
                        title={confirmRemove === person.id ? 'Confirmar remocao' : 'Remover participante'}
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
                    {(person.status ?? 'ativo') === 'inativo' ? (
                      <button type="button" className="moderate-link" onClick={() => setParticipantStatus(person.id, 'ativo')}>
                        Reativar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="moderate-link"
                        disabled={person.id === state?.ownerId}
                        title="Marcar como afastado (nao conta como ativo)"
                        onClick={() => setParticipantStatus(person.id, 'inativo')}
                      >
                        Afastar
                      </button>
                    )}
                    {person.id !== state?.ownerId && !person.isAI && (
                      <button type="button" className="moderate-link" onClick={() => transferOwner(person.id)}>
                        Tornar PO
                      </button>
                    )}
                  </span>
                )}
              </small>
            </span>
            <i className={!offline ? 'online' : ''} />
          </div>
        );
      })}
    </section>
  );
}