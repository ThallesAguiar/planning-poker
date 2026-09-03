import { useState } from 'react';
import { createStory, presentStory, useSelf } from './room-actions';

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  em_votacao: 'Votando',
  em_discussao: 'Discutindo',
  estimada: 'Estimada',
  pulada: 'Pulada',
};

export function StoryPanel() {
  const { state, isPO, currentStory } = useSelf();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const stories = state?.stories ?? [];

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    createStory(title.trim(), description.trim());
    setTitle('');
    setDescription('');
  };

  return (
    <section className="story-panel">
      <h3>Historias</h3>
      {isPO && (
        <form className="story-add" onSubmit={submit}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titulo da historia"
            aria-label="Titulo da historia"
            maxLength={120}
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descricao (opcional)"
            aria-label="Descricao da historia"
            maxLength={400}
          />
          <button className="primary" type="submit" disabled={!title.trim()}>
            Adicionar historia
          </button>
        </form>
      )}

      <div className="story-list">
        {stories.length === 0 && (
          <p className="empty-story">
            {isPO
              ? 'Cadastre historias para comecar a rodada.'
              : 'Aguardando o PO cadastrar as historias.'}
          </p>
        )}
        {stories.map((story) => {
          const active = story.id === currentStory?.id;
          return (
            <article className={`story-row ${active ? 'is-current' : ''} ${story.status === 'estimada' ? 'is-estimated' : ''}`} key={story.id}>
              <div className="story-row-head">
                <b>{story.title}</b>
                <span className={`story-status ${story.status}`}>{STATUS_LABEL[story.status] ?? story.status}</span>
              </div>
              {story.description && <p>{story.description}</p>}
              <div className="story-row-actions">
                <small>
                  #{story.order}
                  {story.rounds > 0 ? ` · ${story.rounds} rodada(s) ${story.finalValue !== null && story.finalValue !== undefined ? `· valor ${String(story.finalValue)}` : ''}` : ''}
                </small>
                {isPO && story.status === 'pendente' && (
                  <button className="secondary" type="button" onClick={() => presentStory(story.id)}>
                    Iniciar rodada
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}