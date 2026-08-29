import { Link, NavLink } from "react-router-dom";

const ROOMS = [
  {
    name: "Sprint 24 - Time A",
    code: "planning-demo",
    players: "8/8 jogadores",
    status: "Em andamento",
    activity: "ha 2 min",
  },
  {
    name: "Refatoracao do Checkout",
    code: "refac-checkout",
    players: "5/8 jogadores",
    status: "Aguardando",
    activity: "ha 1 dia",
  },
  {
    name: "Planejamento Q2",
    code: "q2-planning",
    players: "3/8 jogadores",
    status: "Finalizada",
    activity: "ha 3 dias",
  },
];

function DashboardShell({ children }: { children: React.ReactNode }) {
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
          <NavLink to="/settings">Configuracoes</NavLink>
        </nav>
        <div className="dashboard-user">
          <span>J1</span>
          <div>
            <b>Jogador 1</b>
            <small>Desenvolvedor</small>
          </div>
        </div>
      </aside>
      <section className="dashboard-content">{children}</section>
    </main>
  );
}

export function MyRoomsPage() {
  return (
    <DashboardShell>
      <div className="dashboard-title">
        <div>
          <h1>Minhas Salas</h1>
          <p>Participe ou crie uma nova sala para comecar a estimar.</p>
        </div>
        <Link className="primary dashboard-cta" to="/">
          + Criar nova sala
        </Link>
      </div>
      <div className="room-grid">
        {ROOMS.map((room) => (
          <article className="room-card" key={room.code}>
            <h2>{room.name}</h2>
            <p>Codigo: {room.code}</p>
            <div className="room-meta">
              <span>{room.players}</span>
              <span>{room.status}</span>
            </div>
            <small>Ultima atividade: {room.activity}</small>
            {room.status === "Finalizada" ? (
              <Link className="secondary room-action" to="/report/demo">
                Ver relatorio
              </Link>
            ) : (
              <Link className="primary room-action" to={`/room/${room.code}`}>
                Entrar
              </Link>
            )}
          </article>
        ))}
      </div>
    </DashboardShell>
  );
}

export function ProfilePage() {
  return (
    <DashboardShell>
      <div className="dashboard-title">
        <div>
          <h1>Perfil</h1>
          <p>Ajuste sua identidade de jogo para aparecer na mesa.</p>
        </div>
      </div>
      <div className="profile-layout">
        <section className="profile-card">
          <div className="profile-avatar">J1</div>
          <label>
            Nome publico
            <input defaultValue="Jogador 1" />
          </label>
          <label>
            Papel padrao
            <select defaultValue="Dev">
              <option>Dev</option>
              <option>QA</option>
              <option>Product Owner</option>
              <option>Scrum Master</option>
              <option>Observador</option>
            </select>
          </label>
          <button className="primary" type="button">
            Salvar perfil
          </button>
        </section>
        <section className="profile-card">
          <h2>Preferencias</h2>
          <label className="settings-toggle">
            Sons discretos
            <input type="checkbox" defaultChecked />
          </label>
          <label className="settings-toggle">
            Mostrar justificativas
            <input type="checkbox" defaultChecked />
          </label>
          <label className="settings-toggle">
            Receber alertas de timer
            <input type="checkbox" defaultChecked />
          </label>
        </section>
      </div>
    </DashboardShell>
  );
}

export function SettingsPage() {
  return (
    <DashboardShell>
      <div className="dashboard-title">
        <div>
          <h1>Configuracoes da Sala</h1>
          <p>Defina tempos, IA, deck e comportamento da rodada.</p>
        </div>
      </div>
      <section className="settings-panel">
        <label>
          Tempo de discussao
          <select defaultValue="2">
            <option value="1">1 min</option>
            <option value="2">2 min</option>
            <option value="3">3 min</option>
          </select>
        </label>
        <label>
          Tempo de votacao
          <select defaultValue="1">
            <option value="1">1 min</option>
            <option value="2">2 min</option>
            <option value="5">5 min</option>
          </select>
        </label>
        <label>
          Deck
          <select defaultValue="fibonacci">
            <option value="fibonacci">Fibonacci</option>
            <option value="modified">Fibonacci modificado</option>
            <option value="shirt">T-shirt</option>
          </select>
        </label>
        <label className="settings-toggle">
          Permitir jogador IA
          <input type="checkbox" defaultChecked />
        </label>
        <label className="settings-toggle">
          Mostrar justificativas
          <input type="checkbox" defaultChecked />
        </label>
        <label className="settings-toggle">
          Revelacao automatica
          <input type="checkbox" />
        </label>
        <button className="primary" type="button">
          Salvar
        </button>
      </section>
    </DashboardShell>
  );
}
