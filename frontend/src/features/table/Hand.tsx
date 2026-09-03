import { useState } from 'react';
import { motion } from 'framer-motion';
import { castVote, useSelf } from './room-actions';

export function Hand() {
  const { state, currentStory, canVote, hasVoted, isObserver, phase } = useSelf();
  const [selected, setSelected] = useState<number | string | null>(null);
  const deck = state?.config.deckValues ?? [];

  const playable = canVote && !hasVoted && !isObserver && Boolean(currentStory);
  const playHint = hasVoted ? 'Carta jogada — aguarde a revelacao.' : !currentStory ? 'Nenhuma historia em votacao no momento.' : phase !== 'votacao' ? 'A votacao nao esta aberta.' : 'Selecione uma carta e jogue.';

  return (
    <div className={`hand ${hasVoted || !playable ? 'is-dimmed' : ''}`}>
      <div className="hand-title">
        <span>Sua mao</span>
        <small>{selected === null ? playHint : `Carta ${String(selected)} selecionada`}</small>
        {isObserver && <small>Voce e um Observador: apenas assiste.</small>}
      </div>
      <div className="cards">
        {deck.map((value) => (
          <motion.button
            whileHover={{ y: -10 }}
            whileTap={{ scale: 0.94 }}
            className={selected === value ? 'card selected' : 'card'}
            disabled={!playable}
            onClick={() => setSelected(value)}
            key={String(value)}
          >
            {value === 'café' ? '☕' : String(value)}
          </motion.button>
        ))}
      </div>
      <button
        className="primary play-card"
        type="button"
        disabled={selected === null || !playable}
        onClick={() => {
          if (selected !== null && currentStory) {
            castVote(currentStory.id, selected as never);
            setSelected(null);
          }
        }}
      >
        Jogar carta <span aria-hidden="true">↑</span>
      </button>
    </div>
  );
}