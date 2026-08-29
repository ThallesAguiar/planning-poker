type Props = { enabled: boolean; onChange: (enabled: boolean) => void };

export function RoomConfiguration({ enabled, onChange }: Props) {
  return <label className="ai-config"><input type="checkbox" checked={enabled} onChange={(event) => onChange(event.target.checked)} /> Participante IA</label>;
}
