import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { socket } from "./lib/socket";
import { authHeaders, loginAccount, logoutAccount, registerAccount } from "./lib/auth";
import { useAppStore } from "./stores/app-store";
import { TableScreen } from "./features/table/TableScreen";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const ENTRY_CARDS = ["1", "3", "5", "8", "13", "?"];
const AVATARS = ["♠", "♥", "♦", "♣", "🃏", "🎩"];

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

function PasswordToggleIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function App({ mode }: { mode: "home" | "room" }) {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const routeCode = mode === "room" ? decodeURIComponent(code ?? "") : "";
  const {
    state,
    setState,
    clearState,
    account,
    accountToken,
    setAccountSession,
    clearAccountSession,
    setSelfId,
    setAiStatus,
    setRoomError,
  } = useAppStore();
  const sessionScope = account?.id ?? "guest";
  const roomStorageKey = (kind: "token" | "session" | "participant" | "pending-join" | "password", target: string) =>
    `planning-poker-${kind}:${sessionScope}:${target}`;
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
  const [homeCard, setHomeCard] = useState<"account" | "room">("account");
  const [roomName, setRoomName] = useState("Sprint Planning");
  const [createPrivate, setCreatePrivate] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountError, setAccountError] = useState("");
  const [joined, setJoined] = useState(false);
  const joinedRef = useRef(false);
  const restoreAttemptedFor = useRef("");
  const pendingConnectHandler = useRef<(() => void) | null>(null);
  const [restoringRoom, setRestoringRoom] = useState(() => {
    if (mode !== "room" || !routeCode) return false;
    return Boolean(
      localStorage.getItem(roomStorageKey("token", routeCode)) ||
        sessionStorage.getItem(roomStorageKey("pending-join", routeCode)),
    );
  });

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
      joinedRef.current = true;
      setRestoringRoom(false);
      if (next?.code) {
        sessionStorage.removeItem(roomStorageKey("pending-join", next.code));
      }
    };
    const tick = (next: { remainingSeconds: number }) => {
      const current = useAppStore.getState().state;
      if (current)
        setState({ ...current, remainingSeconds: next.remainingSeconds });
    };
    const error = (next: { code?: string; message?: string }) => {
      const code = next.code ?? "ROOM_ERROR";
      const message = next.message ?? "Erro na sala.";
      useAppStore.getState().setRoomError({ code, message });
      if (!joinedRef.current) {
        setJoinError(message);
        if (routeCode) {
          localStorage.removeItem(roomStorageKey("token", routeCode));
          localStorage.removeItem(roomStorageKey("session", routeCode));
          localStorage.removeItem(roomStorageKey("participant", routeCode));
          sessionStorage.removeItem(roomStorageKey("pending-join", routeCode));
          sessionStorage.removeItem(roomStorageKey("password", routeCode));
        }
        setJoined(false);
        setRestoringRoom(false);
        socket.disconnect();
      }
    };
    const kicked = (payload: { message?: string }) => {
      useAppStore.getState().setRoomError({ code: "REMOVED", message: payload.message ?? "Voce foi removido desta sala." });
      localStorage.removeItem(roomStorageKey("token", routeCode));
      localStorage.removeItem(roomStorageKey("session", routeCode));
      localStorage.removeItem(roomStorageKey("participant", routeCode));
      sessionStorage.removeItem(roomStorageKey("pending-join", routeCode));
      sessionStorage.removeItem(roomStorageKey("password", routeCode));
      clearState();
      setJoined(false);
      joinedRef.current = false;
      socket.disconnect();
      if (mode === "room") navigate("/");
    };
    const participantUpdate = (payload: any) => {
      useAppStore.getState().patchParticipant(payload.participant);
    };
    const ai = (next: { status: "voted" | "unavailable" | "error" | "idle" | "voting" }) =>
      useAppStore.getState().setAiStatus(next.status);
    const reportReady = (payload: { reportId: string }) => {
      if (mode === "room") navigate(`/report/${payload.reportId}`);
    };

    socket.on("room:state", update);
    socket.on("room:error", error);
    socket.on("room:kicked", kicked);
    socket.on("room:participantUpdate", participantUpdate);
    socket.on("timer:tick", tick);
    socket.on("ai:status", ai);
    socket.on("report:ready", reportReady);
    socket.on("connect", () => {
      joinedRef.current = true;
      useAppStore.getState().setConnectionStatus("connected");
    });
    socket.on("disconnect", () => useAppStore.getState().setConnectionStatus("disconnected"));
    socket.on("reconnecting" as never, () => useAppStore.getState().setConnectionStatus("reconnecting"));
    return () => {
      socket.off("room:state", update);
      socket.off("room:error", error);
      socket.off("room:kicked", kicked);
      socket.off("room:participantUpdate", participantUpdate);
      socket.off("timer:tick", tick);
      socket.off("ai:status", ai);
      socket.off("report:ready", reportReady);
    };
  }, [clearState, mode, routeCode, setState, setAiStatus]);

  useEffect(() => {
    if (!account) return;
    setName(account.name);
    setAvatar(account.avatar || avatar);
  }, [account]);

  useEffect(() => {
    if (mode !== "room" || !routeCode) return;
    setRoomId(routeCode);
    setHomeMode("join");
    const currentState = useAppStore.getState().state;
    if (currentState && isSameRoom(currentState.code, currentState.roomId, routeCode)) {
      setJoined(true);
      joinedRef.current = true;
      setRestoringRoom(false);
      return;
    }
    clearState();
    setJoined(false);
    joinedRef.current = false;
    const storedPid = localStorage.getItem(roomStorageKey("participant", routeCode));
    if (storedPid) setSelfId(storedPid);
    setRestoringRoom(
      Boolean(
        localStorage.getItem(roomStorageKey("token", routeCode)) ||
          sessionStorage.getItem(roomStorageKey("pending-join", routeCode)),
      ),
    );
    fetch(`${API}/rooms/${encodeURIComponent(routeCode)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((room) => setRoomIsPrivate(room?.visibility === "PRIVATE"))
      .catch(() => setRoomIsPrivate(false));
  }, [clearState, mode, routeCode, setSelfId]);

  const connectRoom = async (target: string, password = roomPassword) => {
    setJoinError("");
    if (!target) return false;
    setJoined(false);
    joinedRef.current = false;
    setRestoringRoom(true);

    sessionStorage.setItem(
      "planning-poker-player",
      JSON.stringify({ name, avatar }),
    );

    let sessionId =
      localStorage.getItem(roomStorageKey("session", target)) ?? "";
    let token = localStorage.getItem(roomStorageKey("token", target)) ?? "";
    let participantId = localStorage.getItem(roomStorageKey("participant", target)) ?? "";

    if (!token) {
      const response = await fetch(`${API}/rooms/${encodeURIComponent(target)}/join`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders(accountToken) },
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
        participantId = session.participantId ?? "";
        localStorage.setItem(roomStorageKey("session", target), sessionId);
        localStorage.setItem(roomStorageKey("token", target), token);
        if (participantId) {
          localStorage.setItem(roomStorageKey("participant", target), participantId);
          setSelfId(participantId);
        }
      }
    } else if (participantId) {
      setSelfId(participantId);
    }

    sessionStorage.setItem(
      roomStorageKey("pending-join", target),
      JSON.stringify({ password }),
    );
    if (password) {
      sessionStorage.setItem(roomStorageKey("password", target), password);
    }
    setRoomError(null);

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
      const failBySocketError = (payload: { code?: string }) => {
        if (payload?.code === "FORBIDDEN" || payload?.code === "REMOVED") setJoinError("Voce nao pode entrar nesta sala.");
        fail("socket-error");
      };
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
      joinedRef.current = false;
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
    const token = localStorage.getItem(roomStorageKey("token", routeCode));
    const pending = sessionStorage.getItem(
      roomStorageKey("pending-join", routeCode),
    );
    if (!token && !pending) {
      if (accountToken) {
        setRestoringRoom(true);
        void fetch(`${API}/rooms/${encodeURIComponent(routeCode)}/rejoin`, {
          method: "POST",
          headers: authHeaders(accountToken),
        })
          .then(async (response) => {
            if (!response.ok) throw new Error("rejoin failed");
            const session = await response.json();
            localStorage.setItem(roomStorageKey("session", routeCode), session.sessionId);
            localStorage.setItem(roomStorageKey("token", routeCode), session.token);
            if (session.participantId) {
              localStorage.setItem(roomStorageKey("participant", routeCode), session.participantId);
              setSelfId(session.participantId);
            }
            await connectRoom(routeCode, "");
          })
          .catch(() => setRestoringRoom(false));
        return;
      }
      setRestoringRoom(false);
      return;
    }
    const participantId = localStorage.getItem(roomStorageKey("participant", routeCode));
    if (participantId) setSelfId(participantId);
    const password = pending
      ? JSON.parse(pending).password
      : sessionStorage.getItem(roomStorageKey("password", routeCode)) ?? roomPassword;
    sessionStorage.removeItem(roomStorageKey("pending-join", routeCode));
    void connectRoom(routeCode, password);
  }, [accountToken, joined, mode, routeCode, roomPassword, setSelfId]);

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

  const submitAccount = async () => {
    setAccountError("");
    try {
      const session =
        authMode === "register"
          ? await registerAccount({ email, password: accountPassword, name, avatar })
          : await loginAccount({ email, password: accountPassword });
      setAccountSession(session.user, session.token);
      setName(session.user.name);
      setAvatar(session.user.avatar || avatar);
    } catch {
      setAccountError(authMode === "register" ? "Nao foi possivel cadastrar usuario." : "Login invalido.");
    }
  };

  const logout = async () => {
    if (accountToken) await logoutAccount(accountToken).catch(() => undefined);
    clearAccountSession();
    clearState();
    socket.disconnect();
    setJoined(false);
    joinedRef.current = false;
    if (mode === "room") navigate("/");
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

        <div className="home-stack">
          {mode === "home" && (
            <div className="card-switch" role="tablist" aria-label="Sua conta ou mesa">
              <button
                type="button"
                role="tab"
                aria-selected={homeCard === "account"}
                className={homeCard === "account" ? "is-active" : ""}
                onClick={() => setHomeCard("account")}
              >
                Sua conta
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={homeCard === "room"}
                className={homeCard === "room" ? "is-active" : ""}
                onClick={() => setHomeCard("room")}
              >
                Mesa
              </button>
            </div>
          )}

          {mode === "home" && homeCard === "account" && (
            <section className="account-card" aria-label="Sua conta">
              {account ? (
                <div className="account-row">
                  <span>{account.email}</span>
                  <button type="button" onClick={logout}>
                    Sair
                  </button>
                </div>
              ) : (
                <>
                  <div className="mode-switch auth-switch">
                    <button
                      type="button"
                      className={authMode === "login" ? "is-active" : ""}
                      onClick={() => setAuthMode("login")}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      className={authMode === "register" ? "is-active" : ""}
                      onClick={() => setAuthMode("register")}
                    >
                      Cadastro
                    </button>
                  </div>
                  <label>
                    Email
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                  </label>
                  {authMode === "register" && (
                    <label>
                      Nome
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        minLength={1}
                      />
                    </label>
                  )}
                  {authMode === "register" && (
                    <div className="avatar-pick">
                      <span>Seu avatar</span>
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
                  )}
                  <label>
                    Senha da conta
                    <div className="password-field">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        minLength={8}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((current) => !current)}
                      >
                        <PasswordToggleIcon visible={showPassword} />
                      </button>
                    </div>
                  </label>
                  {accountError && <p className="account-error" role="alert">{accountError}</p>}
                  <button type="button" className="secondary auth-action" onClick={submitAccount}>
                    {authMode === "login" ? "Entrar na conta" : "Criar conta"}
                  </button>
                </>
              )}
            </section>
          )}

          {mode === "room" || homeCard === "room" ? (
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
            readOnly={Boolean(account)}
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
                    <PasswordToggleIcon visible={showPassword} />
                  </button>
                </div>
              </label>

              {account ? (
                <div className="avatar-pick">
                  <span>Seu avatar</span>
                  <div>
                    <span className="account-avatar-fixed">{avatar}</span>
                  </div>
                </div>
              ) : (
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
              )}
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
                  Senha da sala
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
                      <PasswordToggleIcon visible={showPassword} />
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
            ) : null}
        </div>
      </main>
    );

  return <TableScreen onLogout={logout} />;
}