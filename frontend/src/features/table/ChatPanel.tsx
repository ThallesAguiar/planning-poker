import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { sendChatMessage, useSelf } from './room-actions';

export function ChatPanel() {
  const { state, phase } = useSelf();
  const [message, setMessage] = useState('');
  const messages = state?.messages ?? [];
  const inDiscussion = phase === 'discussao';

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    sendChatMessage(message.trim());
    setMessage('');
  };

  return (
    <aside className="sidebar chat">
      <div className="chat-heading">
        <h3>{inDiscussion ? 'Discussao' : 'Chat da mesa'}</h3>
        <span>{inDiscussion ? '🔍 justifiquem seus votos' : '● ao vivo'}</span>
      </div>
      {inDiscussion && <p className="discussion-banner">Divergencia! Discutam e justifiquem antes de revotar ou finalizar.</p>}
      <div className="messages">
        <AnimatePresence initial={false}>
          {messages.map((item) => (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`message ${item.type}`}
              key={item.id}
            >
              <b>{item.author}</b>
              <small>{item.role}</small>
              <p>{item.text}</p>
            </motion.div>
          ))}
        </AnimatePresence>
        {!messages.length && (
          <div className="empty-chat">
            As justificativas aparecem aqui.
            <br />
            Que comece a conversa.
          </div>
        )}
      </div>
      <form className="chat-input" onSubmit={submit}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Escreva uma mensagem..."
          aria-label="Mensagem do chat"
        />
        <button title="Enviar">↑</button>
      </form>
    </aside>
  );
}