import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DashboardShell } from '../../../components/layout/DashboardPages';
import { RoomStudioPanel } from '../../../components/room/RoomStudioPanel';
import { useAppStore } from '../../../stores/app-store';
import { claimGuestRoomOwnership } from '../../../api/room-studio';

export function RoomStudioPage() {
  const { code = '' } = useParams<{ code: string }>();
  const { account, accountToken, state } = useAppStore();
  const [roomId, setRoomId] = useState<string | null>(
    state?.code?.toLowerCase() === code.toLowerCase() ? state.roomId : null,
  );
  const [resolved, setResolved] = useState(Boolean(roomId));
  const [loading, setLoading] = useState(Boolean(code && !roomId));

  useEffect(() => {
    if (!code || resolved) return;
    let active = true;
    void fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/rooms/${encodeURIComponent(code)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then(async (room) => {
        if (!room?.id) return null;
        const guestToken = localStorage.getItem(`planning-poker-token:guest:${code}`);
        if (accountToken && guestToken) {
          await claimGuestRoomOwnership(accountToken, room.id, guestToken).catch(() => undefined);
        }
        return room.id;
      })
      .then((resolvedRoomId) => {
        if (active) setRoomId(resolvedRoomId);
      })
      .catch(() => {
        if (active) setRoomId(null);
      })
      .finally(() => {
        if (active) {
          setResolved(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [accountToken, code, resolved]);

  if (!account || !accountToken) {
    return <DashboardShell><div className="dashboard-title"><div><h1>Studio da mesa</h1><p>Entre com sua conta para configurar a IA desta mesa.</p></div></div><Link className="primary" to="/">Ir para home</Link></DashboardShell>;
  }

  if (loading) {
    return <DashboardShell><div className="dashboard-title"><div><h1>Studio da mesa</h1><p>Carregando mesa...</p></div></div></DashboardShell>;
  }

  if (!roomId) {
    return <DashboardShell><div className="dashboard-title"><div><h1>Studio da mesa</h1><p>Sala não encontrada.</p></div></div><Link className="primary" to="/rooms">Ver minhas salas</Link></DashboardShell>;
  }

  return <DashboardShell><div className="dashboard-title room-studio-title"><div><h1>Studio de IA da sala</h1><p className="studio-note">Esta configuração vale somente para mesa <strong>{code}</strong>. Você pode herdar configurações da sua conta ou criar uma IA exclusiva.</p></div><div className="room-studio-actions"><span className="studio-badge ok">Mesa {code}</span><Link className="secondary" to={`/room/${encodeURIComponent(code)}`}>Voltar para mesa</Link></div></div><RoomStudioPanel roomId={roomId} /></DashboardShell>;
}
