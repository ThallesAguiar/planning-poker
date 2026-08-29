import { FormEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import { socket } from "./lib/socket";
import { useAppStore } from "./stores/app-store";
import { RoomConfiguration } from "./features/room/RoomConfiguration";
import { AIParticipant } from "./features/table/AIParticipant";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const ENTRY_CARDS = ["1", "3", "5", "8", "13", "?"];
const AVATARS = ["🦊", "🐼", "🐙", "🦄", "🐸", "🦁"];

function normalizeRoomCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const roomIndex = parts.indexOf("room");
    return roomIndex >= 0 ? (parts[roomIndex + 1] ?? "") : (parts.at(-1) ?? "");
  } catch {
    const parts = trimmed.split("/").filter(Boolean);
    const roomIndex = parts.indexOf("room");
    return roomIndex >= 0 ? (parts[roomIndex + 1] ?? "") : (parts.at(-1) ?? "");
  }
}

function isSameRoom(stateCode: string | undefined, stateRoomId: string | undefined, target: string) {
  const expected = target.toLowerCase();
  return (
    stateCode?.toLowerCase() === expected ||
    stateRoomId?.toLowerCase() === expected
  );
}

export function App({ mode }: { mode: "home" | "room" }) {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const routeCode = mode === "room" ? decodeURIComponent(code ?? "") : "";
  const { state, setState, clearState } = useAppStore();
  const [roomId, setRoomId] = useState(routeCode || "planning-demo");
  const [name, setName] = useState(
    () =>
      JSON.parse(sessionStorage.getItem("planning-poker-player") ?? "null")
        ?.name ?? "Jogador",
  );
  const [avatar, setAvatar] = useState(
    () =>
      JSON.parse(sessionStorage.getItem("planning-poker-player") ?? "null")
        ?.avatar ?? AVATARS[0],
  );
  const [roomPassword, setRoomPassword] = useState("");
  const [joinError, setJoinError] = useState("");
  const [roomIsPrivate, setRoomIsPrivate] = useState(false);
  const [homeMode, setHomeMode] = useState<"join" | "create">("join");
  const [roomName, setRoomName] = useState("Sprint Planning");
  const [createPrivate, setCreatePrivate] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<number | string | null>(null);
  const [joined, setJoined] = useState(false);
  const restoreAttemptedFor = useRef("");
  const pendingConnectHandler = useRef<(() => void) | null>(null);
  const [restoringRoom, setRestoringRoom] = useState(() => {
    if (mode !== "room" || !routeCode) return false;
    return Boolean(
      localStorage.getItem(`planning-poker-token:${routeCode}`) ||
        sessionStorage.getItem(`planning-poker-pending-join:${routeCode}`),
    );
  });
  const [aiStatus, setAiStatus] = useState<
    "idle" | "voted" | "unavailable" | "error"
  >("idle");

  useEffect(() => {
    const update = (next: any) => {
      if (
        mode === "room" &&
        routeCode &&
        !isSameRoom(next?.code, next?.roomId, routeCode)
      ) {
        return;
      }
      setState(next);
      setJoined(true);
      setRestoringRoom(false);
      if (next?.code) {
        sessionStorage.removeItem(`planning-poker-pending-join:${next.code}`);
      }
    };
    const tick = (next: { remainingSeconds: number }) => {
      const current = useAppStore.getState().state;
      if (current)
        setState({ ...current, remainingSeconds: next.remainingSeconds });
    };
    socket.on("room:state", update);
    const error = (next: { message: string }) => {
      setJoinError(
        next.message === "PASSWORD_REQUIRED"
          ? "Esta sala exige senha."
          : next.message === "ROOM_NOT_FOUND"
            ? "Sala nao encontrada."
            : "Senha invalida ou sala indisponivel.",
      );
      if (routeCode) {
        localStorage.removeItem(`planning-poker-token:${routeCode}`);
        localStorage.removeItem(`planning-poker-session:${routeCode}`);
        sessionStorage.removeItem(`planning-poker-pending-join:${routeCode}`);
        sessionStorage.removeItem(`planning-poker-password:${routeCode}`);
      }
      setJoined(false);
      setRestoringRoom(false);
      socket.disconnect();
    };
    socket.on("room:error", error);
    socket.on("timer:tick", tick);
    const ai = (next: { status: "voted" | "unavailable" | "error" }) =>
      setAiStatus(next.status);
    socket.on("ai:status", ai);
    socket.on("connect", () => useAppStore.getState().setSocketConnected(true));
    socket.on("disconnect", () =>
      useAppStore.getState().setSocketConnected(false),
    );
    return () => {
      socket.off("room:state", update);
      socket.off("room:error", error);
      socket.off("timer:tick", tick);
      socket.off("ai:status", ai);
    };
  }, [clearState, mode, routeCode, setState]);

  useEffect(() => {
    if (mode !== "room" || !routeCode) return;
    setRoomId(routeCode);
    setHomeMode("join");
    const currentState = useAppStore.getState().state;
    if (currentState && isSameRoom(currentState.code, currentState.roomId, routeCode)) {
      setJoined(true);
      setRestoringRoom(false);
      return;
    }
    clearState();
    setJoined(false);
    setRestoringRoom(
      Boolean(
        localStorage.getItem(`planning-poker-token:${routeCode}`) ||
          sessionStorage.getItem(`planning-poker-pending-join:${routeCode}`),
      ),
    );
    fetch(`${API}/rooms/${encodeURIComponent(routeCode)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((room) => setRoomIsPrivate(room?.visibility === "PRIVATE"))
      .catch(() => setRoomIsPrivate(false));
  }, [clearState, mode, routeCode]);

  const current =
    state?.stories.find((story) => story.id === state.currentStoryId) ??
    state?.stories[0];
  const deck = state?.config.deckValues ?? [
    1,
    2,
    3,
    5,
    8,
    13,
    20,
    40,
    100,
    "cafe",
    "?",
  ];
  const progress = state
    ? Math.round(
        (state.votes.length /
          Math.max(
            1,
            state.participants.filter((p) => p.role !== "Observador").length,
          )) *
          100,
      )
    : 0;

  const connectRoom = async (target: string, password = roomPassword) => {
    setJoinError("");
    if (!target) return false;
    setJoined(false);
    setRestoringRoom(true);

    sessionStorage.setItem(
      "planning-poker-player",
      JSON.stringify({ name, avatar }),
    );

    let sessionId =
      localStorage.getItem(`planning-poker-session:${target}`) ?? "";
    let token = localStorage.getItem(`planning-poker-token:${target}`) ?? "";

    if (!token) {
      const response = await fetch(`${API}/rooms/${encodeURIComponent(target)}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          avatar,
          role: "Dev",
          password: password || undefined,
        }),
      });

      if (response.status === 404) {
        setJoinError("Sala nao encontrada.");
        setRestoringRoom(false);
        return false;
      } else if (!response.ok) {
        setJoinError("Senha invalida ou sala indisponivel.");
        setRestoringRoom(false);
        return false;
      } else {
        const session = await response.json();
        sessionId = session.sessionId;
        token = session.token;
        localStorage.setItem(`planning-poker-session:${target}`, sessionId);
        localStorage.setItem(`planning-poker-token:${target}`, token);
      }
    }

    sessionStorage.setItem(
      `planning-poker-pending-join:${target}`,
      JSON.stringify({ password }),
    );
    if (password) {
      sessionStorage.setItem(`planning-poker-password:${target}`, password);
    }

    if (pendingConnectHandler.current) {
      socket.off("connect", pendingConnectHandler.current);
      pendingConnectHandler.current = null;
    }

    const confirmation = new Promise<"confirmed" | "socket-error" | "timeout">((resolve) => {
      let finished = false;
      const cleanup = () => {
        finished = true;
        window.clearTimeout(timer);
        socket.off("room:state", confirm);
        socket.off("room:error", failBySocketError);
      };
      const confirm = (next: any) => {
        if (!isSameRoom(next?.code, next?.roomId, target)) return;
        cleanup();
        resolve("confirmed");
      };
      const fail = (reason: "socket-error" | "timeout") => {
        if (finished) return;
        cleanup();
        resolve(reason);
      };
      const failBySocketError = () => fail("socket-error");
      const timer = window.setTimeout(() => fail("timeout"), 6000);
      socket.on("room:state", confirm);
      socket.once("room:error", failBySocketError);
    });

    const emitJoin = () =>
      socket.emit("room:join", {
        roomId: target,
        name,
        avatar,
        role: "Dev",
        sessionId,
        token,
        password: password || undefined,
      });

    if (socket.connected) emitJoin();
    else {
      socket.once("connect", emitJoin);
      pendingConnectHandler.current = emitJoin;
      socket.connect();
    }

    const confirmationResult = await confirmation;
    const confirmed = confirmationResult === "confirmed";
    if (pendingConnectHandler.current === emitJoin) {
      socket.off("connect", emitJoin);
      pendingConnectHandler.current = null;
    }
    if (!confirmed) {
      setRestoringRoom(false);
      setJoined(false);
      if (confirmationResult === "timeout") {
        setJoinError("Nao foi possivel entrar na sala.");
      }
    }
    return confirmed;
  };

  const join = async (event: FormEvent) => {
    event.preventDefault();
    const target = mode === "room" ? routeCode : normalizeRoomCode(roomId);
    const connected = await connectRoom(target);
    if (connected && mode === "home") {
      navigate(`/room/${encodeURIComponent(target)}`);
    }
  };

  useEffect(() => {
    if (mode !== "room" || !routeCode || joined) return;
    if (restoreAttemptedFor.current === routeCode) return;
    restoreAttemptedFor.current = routeCode;
    const token = localStorage.getItem(`planning-poker-token:${routeCode}`);
    const pending = sessionStorage.getItem(
      `planning-poker-pending-join:${routeCode}`,
    );
    if (!token && !pending) {
      setRestoringRoom(false);
      return;
    }
    const password = pending
      ? JSON.parse(pending).password
      : sessionStorage.getItem(`planning-poker-password:${routeCode}`) ?? roomPassword;
    sessionStorage.removeItem(`planning-poker-pending-join:${routeCode}`);
    void connectRoom(routeCode, password);
  }, [joined, mode, routeCode, roomPassword]);

  const submitHome = async (event: FormEvent) => {
    event.preventDefault();

    if (mode === "room" || homeMode === "join") {
      await join(event);
      return;
    }

    if (createPrivate && roomPassword.length < 4) {
      setJoinError("Senha privada precisa ter pelo menos 4 caracteres.");
      return;
    }

    const response = await fetch(`${API}/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: roomName,
        visibility: createPrivate ? "PRIVATE" : "PUBLIC",
        password: createPrivate ? roomPassword : undefined,
      }),
    });

    if (!response.ok) {
      setJoinError("Nao foi possivel criar a sala.");
      return;
    }

    const created = await response.json();
    const connected = await connectRoom(
      created.code,
      createPrivate ? roomPassword : "",
    );
    if (connected) navigate(`/room/${encodeURIComponent(created.code)}`);
  };

  const cast = () => {
    if (selected !== null)
      socket.emit("vote:cast", {
        storyId: current?.id ?? "",
        value: selected as any,
      });
  };

  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    socket.emit("chat:message", { text: message });
    setMessage("");
  };

  const configureAi = (enabled: boolean) => {
    setAiStatus("idle");
    socket.emit("room:configure", {
      config: { permiteParticipantesIA: enabled },
    });
  };

  const requestAiVote = () => {
    setAiStatus("idle");
    socket.emit("ai:requestVote");
  };

  const hasConfirmedRoom =
    mode === "room" &&
    joined &&
    Boolean(state && isSameRoom(state.code, state.roomId, routeCode));
  const isRoomEntry = mode === "room" && !hasConfirmedRoom && !restoringRoom;

  if (mode === "room" && restoringRoom && !hasConfirmedRoom)
    return (
      <main className="restoring-shell">
        <div className="restoring-card" aria-live="polite">
          <div className="brand-mark">♠</div>
          <h2>Reconectando sala...</h2>
          <span className="restoring-spinner" aria-hidden="true" />
          <p className="room-loading-copy">
            Restaurando sua sessao e abrindo mesa.
          </p>
        </div>
      </main>
    );

  if (mode === "home" || isRoomEntry)
    return (
      <main className="entry home-entry">
        <section className="home-hero" aria-label="Planning Poker">
          <p className="home-kicker">PLANNING POKER</p>
          <h1>
            Faca a estimativa
            <span> ganhar vida.</span>
          </h1>
          <p>
            Uma mesa colaborativa para times que pensam melhor juntos.
          </p>
          <div className="entry-card-fan" aria-hidden="true">
            {ENTRY_CARDS.map((value) => (
              <span key={value}>{value}</span>
            ))}
          </div>
        </section>

        <form className="join-panel" onSubmit={submitHome}>
          <div className="brand-mark">♠</div>

          {mode === "home" && (
            <div className="mode-switch">
              <button
                type="button"
                className={homeMode === "join" ? "is-active" : ""}
                onClick={() => setHomeMode("join")}
              >
                Entrar
              </button>
              <button
                type="button"
                className={homeMode === "create" ? "is-active" : ""}
                onClick={() => setHomeMode("create")}
              >
                Criar sala
              </button>
            </div>
          )}

          <h2>
            {mode === "room"
              ? roomIsPrivate
                ? "Entrar na sala privada"
                : "Entrar na mesa"
              : homeMode === "join"
                ? "Entrar na mesa"
                : "Criar nova sala"}
          </h2>

          <label>
            Nome
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          {mode === "room" || homeMode === "join" ? (
            <>
              <label>
                Codigo da sala
                <input
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  required
                  readOnly={mode === "room"}
                />
              </label>

              <label>
                Senha da sala
                <div className="password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                    placeholder="Opcional"
                    required={mode === "room" && roomIsPrivate}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </div>
              </label>

              <div className="avatar-pick">
                <span>Escolha seu avatar</span>
                <div>
                  {AVATARS.map((item) => (
                    <button
                      type="button"
                      className={avatar === item ? "active" : ""}
                      onClick={() => setAvatar(item)}
                      key={item}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <label>
                Nome da sala
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  required
                />
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={createPrivate}
                  onChange={(e) => setCreatePrivate(e.target.checked)}
                />{" "}
                Sala privada
              </label>

              {createPrivate && (
                <label>
                  Senha
                  <div className="password-field">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={roomPassword}
                      onChange={(e) => setRoomPassword(e.target.value)}
                      minLength={4}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      aria-label={
                        showPassword ? "Ocultar senha" : "Mostrar senha"
                      }
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? "🙈" : "👁"}
                    </button>
                  </div>
                </label>
              )}
            </>
          )}

          {joinError && <p role="alert">{joinError}</p>}

          <button className="primary" type="submit">
            <span>
              {mode === "room" || homeMode === "join"
                ? "Entrar na sala"
                : "Criar sala"}
            </span>
            <span aria-hidden="true">-&gt;</span>
          </button>

          <p className="home-tip">
            <span aria-hidden="true">i</span>
            {mode === "room" || homeMode === "join"
              ? "Dica: peca o codigo da sala para o Product Owner iniciar a partida."
              : "Dica: salas privadas pedem uma senha com pelo menos 4 caracteres."}
          </p>
        </form>
      </main>
    );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="wordmark">
          <span>♠</span> planning poker
        </div>
        <div className="session-title">
          <small>SESSAO AO VIVO</small>
          <strong>{state?.name ?? "Sprint 24 - Time A"}</strong>
        </div>
        <div className="phase-pill">
          <small>Fase: {state?.phase === "revelada" ? "Revelacao" : "Votacao"}</small>
          <strong>
            {state?.remainingSeconds
              ? `${Math.floor(state.remainingSeconds / 60)}:${String(state.remainingSeconds % 60).padStart(2, "0")}`
              : "00:45"}
          </strong>
        </div>
        <div className="top-actions">
          <button type="button">Chat</button>
          <button type="button">Pessoas</button>
          <Link to="/settings">Configuracoes</Link>
          <Link to="/rooms">Sair</Link>
          <RoomConfiguration
            enabled={state?.config.permiteParticipantesIA ?? false}
            onChange={configureAi}
          />
          <div className="user-avatar">{avatar}</div>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar left">
          <div className="side-heading">
            <span>Sua mesa</span>
            <b>{state?.code ?? roomId}</b>
          </div>
          <div className="people">
            <h3>
              Participantes <small>{state?.participants.length ?? 0}</small>
            </h3>
            {state?.participants.map((person) => (
              <div className="person" key={person.id}>
                <span className="person-avatar">{person.avatar}</span>
                <span>
                  <b>{person.name}</b>
                  <small>
                    {person.role}
                    {person.id === socket.id ? " · Voce" : ""}
                  </small>
                </span>
                <i className={person.connected ? "online" : ""} />
              </div>
            ))}
          </div>
          <div className="rules">
            <h3>Regras da sala</h3>
            <p>
              <b>Fibonacci</b>
              <br />
              Voto anonimo ate revelar
              <br />
              Reflexao: 2 minutos
            </p>
          </div>
          <button
            className="report-link"
            onClick={() =>
              fetch(`${API}/rooms/${roomId}/report`, { method: "POST" })
            }
          >
            ▣ Gerar relatorio
          </button>
        </aside>

        <section className="table-area">
          <div className="story-header">
            <div>
              <small>HISTORIA ATUAL</small>
              <h2>{current?.title ?? "Aguardando proxima historia"}</h2>
              <p>
                {current?.description ??
                  "O PO pode iniciar uma historia para comecar a rodada."}
              </p>
            </div>
            <div className="timer">
              <small>TEMPO DE REFLEXAO</small>
              <strong>
                {state?.remainingSeconds
                  ? `${Math.floor(state.remainingSeconds / 60)}:${String(state.remainingSeconds % 60).padStart(2, "0")}`
                  : "02:00"}
              </strong>
            </div>
          </div>

          <div className="felt">
            <div className="felt-ring" />
            <div className="table-label">
              <span>RODADA DE VOTACAO</span>
              <strong>
                {state?.phase === "revelada"
                  ? "Cartas reveladas"
                  : "Escolha sua carta"}
              </strong>
            </div>
            <div className="players-around">
              {state?.participants.slice(0, 6).map((person, index) => (
                <motion.div
                  className={`seat seat-${index}`}
                  animate={{ y: person.hasVoted ? -8 : 0 }}
                  key={person.id}
                >
                  <span className="seat-avatar">{person.avatar}</span>
                  <small>{person.name}</small>
                  {person.hasVoted && <span className="face-down">?</span>}
                </motion.div>
              ))}
            </div>
            <div className="progress">
              <div>
                <span>
                  {state?.votes.length ?? 0} de{" "}
                  {state?.participants.length ?? 0} jogaram
                </span>
                <b>{progress}%</b>
              </div>
              <div className="progress-track">
                <motion.i animate={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="table-actions">
              <button
                className="secondary"
                onClick={() => socket.emit("vote:forceReveal")}
              >
                Revelar cartas
              </button>
              <button
                className="primary"
                onClick={cast}
                disabled={selected === null}
              >
                Jogar carta <span>↑</span>
              </button>
              <AIParticipant
                enabled={state?.config.permiteParticipantesIA ?? false}
                status={aiStatus}
                onRequest={requestAiVote}
              />
            </div>
          </div>

          <div className="hand">
            <div className="hand-title">
              <span>Sua mao</span>
              <small>
                {selected === null
                  ? "Selecione uma carta"
                  : `Carta ${selected} selecionada`}
              </small>
            </div>
            <div className="cards">
              {deck.map((value) => (
                <motion.button
                  whileHover={{ y: -10 }}
                  whileTap={{ scale: 0.94 }}
                  className={selected === value ? "card selected" : "card"}
                  onClick={() => setSelected(value)}
                  key={String(value)}
                >
                  {value === "cafe" ? "☕" : value}
                </motion.button>
              ))}
            </div>
          </div>
        </section>

        <aside className="sidebar chat">
          <div className="chat-heading">
            <h3>Chat da mesa</h3>
            <span>● ao vivo</span>
          </div>
          <div className="messages">
            <AnimatePresence initial={false}>
              {state?.messages.map((item) => (
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
            {!state?.messages.length && (
              <div className="empty-chat">
                As justificativas aparecem aqui.
                <br />
                Que comece a conversa.
              </div>
            )}
          </div>
          <form className="chat-input" onSubmit={sendMessage}>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escreva uma mensagem..."
            />
            <button title="Enviar">↑</button>
          </form>
        </aside>
      </div>
    </main>
  );
}
