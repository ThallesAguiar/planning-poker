import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { getRoomDefaults, loadMyRooms, setRoomDefaults, updateProfile, type RoomDefaults } from "../../lib/auth";
import { useAppStore } from "../../stores/app-store";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { account } = useAppStore();
  return (
    <main className="dashboard-shell">
      <aside className="dashboard-nav">
        <Link to="/" className="dashboard-brand">
          <span>PP</span>
          Planning Poker
        </Link>
        <nav>
          <NavLink to="/">Home</NavLink>
          <NavLink to="/rooms">Minhas Salas</NavLink>
          <NavLink to="/profile">Perfil</NavLink>
        </nav>
        <div className="dashboard-user">
          <span>{account?.name?.slice(0, 2).toUpperCase() ?? "J1"}</span>
          <div>
            <b>{account?.name ?? "Jogador 1"}</b>
            <small>{account?.avatar ?? ""}</small>
          </div>
        </div>
      </aside>
      <section className="dashboard-content">{children}</section>
    </main>
  );
}

const STATUS_LABELS: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  encerrada: "Encerrada",
};

const ROLE_LABELS: Record<string, string> = {
  PO: "PO",
  Dev: "Dev",
  QA: "QA",
  ScrumMaster: "SM",
  Observador: "Obs",
  IA_Agente: "IA",
};

function roomStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

export function MyRoomsPage() {
  const { accountToken, accountRooms, setAccountRooms } = useAppStore();
  const [loading, setLoading] = useState(Boolean(accountToken));

  useEffect(() => {
    if (!accountToken) {
      setAccountRooms([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadMyRooms(accountToken).then(setAccountRooms).catch(() => setAccountRooms([])).finally(() => setLoading(false));
  }, [accountToken, setAccountRooms]);

  if (loading) return <DashboardShell><p>Carregando suas salas...</p></DashboardShell>;

  const renderAction = (room: { status: string; reportId: string | null; code: string }) => {
    if (room.status === "encerrada") {
      return room.reportId ? (
        <Link className="secondary room-action" to={`/report/${room.reportId}/${room.code}`}>
          Ver relatorio
        </Link>
      ) : (
        <button className="secondary room-action" type="button" disabled title="Esta sala ainda nao gerou relatorio">
          Sem relatorio
        </button>
      );
    }
    return <Link className="primary room-action" to={`/room/${room.code}`}>Entrar</Link>;
  };

  return (
    <DashboardShell>
      <div className="dashboard-title">
        <div>
          <h1>Minhas Salas</h1>
          <p>Participe ou crie uma nova sala para comecar a estimar.</p>
        </div>
        <Link className="primary dashboard-cta" to="/">+ Criar nova sala</Link>
      </div>
      <div className="room-grid">
        {!accountToken && (
          <article className="room-card">
            <h2>Entre com sua conta</h2>
            <p>Faca login na aba &quot;Sua conta&quot; para suas salas aparecerem aqui.</p>
            <Link className="primary room-action" to="/">Ir para home</Link>
          </article>
        )}
        {accountToken && accountRooms.length === 0 && (
          <article className="room-card">
            <h2>Nenhuma sala vinculada</h2>
            <p>Entre ou crie uma sala com sua conta para ela aparecer aqui.</p>
            <Link className="primary room-action" to="/">Entrar</Link>
          </article>
        )}
        {accountRooms.map((room) => (
          <article className="room-card" key={room.id}>
            <h2>{room.name}</h2>
            <p>Codigo: {room.code}</p>
            <div className="room-meta">
              <span>{ROLE_LABELS[room.role] ?? room.role}</span>
              <span>{roomStatusLabel(room.status)}</span>
            </div>
            <small>Ultima atividade: {new Date(room.lastSeenAt).toLocaleString()}</small>
            {room.isOwner && <small className="room-owner-tag">Voce e dono</small>}
            {room.reportGeneratedAt && <small>Relatorio: {new Date(room.reportGeneratedAt).toLocaleString()}</small>}
            {renderAction(room)}
          </article>
        ))}
      </div>
    </DashboardShell>
  );
}

const AVATARS = ["♠", "♥", "♦", "♣", "🃏", "🎩"];

export function ProfilePage() {
  const { account, accountToken, patchAccount } = useAppStore();
  const [name, setName] = useState(account?.name ?? "");
  const [avatar, setAvatar] = useState(account?.avatar ?? AVATARS[0]);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      setName(account.name ?? "");
      setAvatar(account.avatar ?? AVATARS[0]);
    }
  }, [account]);

  if (!account || !accountToken) {
    return (
      <DashboardShell>
        <div className="dashboard-title"><div><h1>Perfil</h1><p>Entre com sua conta para editar o perfil.</p></div></div>
        <Link className="primary" to="/">Ir para home</Link>
      </DashboardShell>
    );
  }

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateProfile(accountToken, { name: name.trim() || undefined, avatar });
      patchAccount(updated);
      setMessage({ kind: "ok", text: "Perfil atualizado." });
    } catch {
      setMessage({ kind: "error", text: "Nao foi possivel salvar. Tente novamente." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell>
      <div className="dashboard-title">
        <div><h1>Perfil</h1><p>Ajuste sua identidade de jogo para aparecer na mesa.</p></div>
      </div>
      <div className="profile-layout">
        <section className="profile-card">
          <div className="profile-avatar">{avatar}</div>
          <label>
            Nome publico
            <input value={name} onChange={(e) => setName(e.target.value)} minLength={1} />
          </label>
          <label>
            Seu avatar
            <div className="avatar-pick">
              <div>
                {AVATARS.map((item) => (
                  <button type="button" className={avatar === item ? "active" : ""} onClick={() => setAvatar(item)} key={item}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </label>
          <button className="primary" type="button" onClick={() => void save()} disabled={saving || !name.trim()}>
            {saving ? "Salvando..." : "Salvar perfil"}
          </button>
          {message && <p className={message.kind === "ok" ? "account-ok" : "account-error"} role="status">{message.text}</p>}
        </section>
      </div>
    </DashboardShell>
  );
}

const DECK_PRESETS: Record<string, { deckType: string; deckValues: Array<number | string> }> = {
  fibonacci: { deckType: "fibonacci", deckValues: [1, 2, 3, 5, 8, 13, 20, 40, 100, "café", "?"] },
  fibonacci_modificado: { deckType: "fibonacci_modificado", deckValues: [0, 1, 2, 3, 5, 8, 13, 20, 40, 100, "?"] },
  tshirt: { deckType: "tshirt", deckValues: ["XS", "S", "M", "L", "XL", "XXL", "?"] },
};

export function SettingsPage() {
  const { account } = useAppStore();
  const scope = account?.id ?? "guest";
  const [reflexao, setReflexao] = useState(120);
  const [discussao, setDiscussao] = useState(300);
  const [deckKey, setDeckKey] = useState("fibonacci");
  const [ia, setIa] = useState(false);
  const [discute, setDiscute] = useState(false);
  const [anonimo, setAnonimo] = useState(false);
  const [automatic, setAutomatic] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    const defaults = getRoomDefaults(scope) as RoomDefaults;
    setReflexao(defaults.tempoReflexaoSegundos ?? 120);
    setDiscussao(defaults.tempoDiscussaoSegundos ?? 300);
    setIa(defaults.permiteParticipantesIA ?? false);
    setDiscute(defaults.iaDiscute ?? false);
    setAnonimo(defaults.votoAnonimo ?? false);
    setAutomatic(defaults.revelacaoAutomatica ?? false);
    const type = defaults.deckType ?? "fibonacci";
    setDeckKey(type in DECK_PRESETS ? type : "fibonacci");
  }, [scope]);

  const save = () => {
    const preset = DECK_PRESETS[deckKey];
    setRoomDefaults(scope, {
      tempoReflexaoSegundos: reflexao,
      tempoDiscussaoSegundos: discussao,
      permiteParticipantesIA: ia,
      iaDiscute: discute,
      votoAnonimo: anonimo,
      revelacaoAutomatica: automatic,
      deckType: preset.deckType,
      deckValues: preset.deckValues,
    });
    setMessage({ kind: "ok", text: "Padroes salvos. Valerao nas proximas salas que voce criar." });
  };

  return (
    <DashboardShell>
      <div className="dashboard-title">
        <div>
          <h1>Padroes de nova sala</h1>
          <p>Tempos, deck e IA que suas proximas salas ja nascem usando. A config dentro da mesa continua valendo como final.</p>
        </div>
      </div>
      <section className="settings-panel">
        <label>
          Tempo de votacao (segundos)
          <select value={reflexao} onChange={(e) => setReflexao(Number(e.target.value))}>
            <option value={60}>1 min</option>
            <option value={120}>2 min</option>
            <option value={300}>5 min</option>
          </select>
        </label>
        <label>
          Tempo de discussao (segundos)
          <select value={discussao} onChange={(e) => setDiscussao(Number(e.target.value))}>
            <option value={60}>1 min</option>
            <option value={120}>2 min</option>
            <option value={300}>5 min</option>
            <option value={600}>10 min</option>
          </select>
        </label>
        <label>
          Deck
          <select value={deckKey} onChange={(e) => setDeckKey(e.target.value)}>
            <option value="fibonacci">Fibonacci</option>
            <option value="fibonacci_modificado">Fibonacci modificado</option>
            <option value="tshirt">T-shirt</option>
          </select>
        </label>
        <label className="settings-toggle">
          Permitir jogador IA
          <input type="checkbox" checked={ia} onChange={(e) => setIa(e.target.checked)} />
        </label>
        <label className="settings-toggle">
          IA discute (na discussao)
          <input type="checkbox" checked={discute} onChange={(e) => setDiscute(e.target.checked)} disabled={!ia} />
        </label>
        <label className="settings-toggle">
          Voto anonimo
          <input type="checkbox" checked={anonimo} onChange={(e) => setAnonimo(e.target.checked)} />
        </label>
        <label className="settings-toggle">
          Revelacao automatica
          <input type="checkbox" checked={automatic} onChange={(e) => setAutomatic(e.target.checked)} />
        </label>
        <button className="primary" type="button" onClick={save}>Salvar padroes</button>
        {message && <p className={message.kind === "ok" ? "account-ok" : "account-error"} role="status">{message.text}</p>}
      </section>
    </DashboardShell>
  );
}