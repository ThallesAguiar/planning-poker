import { useAppStore } from "../../stores/app-store";
import { RoomStudioForm } from "./RoomStudioForm";

export function RoomStudioPanel({ roomId: suppliedRoomId }: { roomId?: string } = {}) {
  const state = useAppStore((s) => s.state);
  const account = useAppStore((s) => s.account);
  const accountToken = useAppStore((s) => s.accountToken);
  const roomId = suppliedRoomId ?? state?.roomId;

  if (!account || !accountToken || !roomId) {
    return (
      <section className="studio-panel">
        <h4>Studio de IA da sala</h4>
        <p className="config-notice">Entre na sua conta para configurar a IA desta mesa. Sem conta, a mesa usa a IA padrão do sistema.</p>
      </section>
    );
  }

  return (
    <>
      <RoomStudioForm roomId={roomId} accountToken={accountToken} />
    </>
  );
}
