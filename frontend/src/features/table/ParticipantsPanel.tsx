import { useState } from 'react';
import { removeParticipant, setParticipantStatus, transferOwner, useSelf } from './room-actions';

function presenceLabel(participant: { connected: boolean; status?: string; role: string }) {
  if ((participant.status ?? 'ativo') === 'inativo') return 'Inativo';
  if (!participant.connected) return 'Offline';
  return participant.role;
}

export function ParticipantsPanel() {
  const { state, selfId, isPO } = useSelf();
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const participants = state?.participants ?? [];

  const ownerLabel = (participantId: string) => (state?.ownerId === participantId ? ' (PO)' : '');

  return (
    <section className="people participant-panel">
      <h3>
        Participantes <small>{participants.length}</small>
      </h3>
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