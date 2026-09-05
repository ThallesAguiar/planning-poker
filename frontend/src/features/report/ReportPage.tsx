import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { downloadCsv, downloadPdf, getReport } from './report-api';

const BADGE_LABELS: Record<string, string> = {
  'primeira-estimativa': '🏆 Primeira estimativa',
  'backlog-concluido': '✅ Backlog concluído',
  'time-participativo': '🤝 Time participativo',
  'consenso-unanime': '🎯 Consenso unânime',
  'divergencia-resolvida': '🧭 Divergência resolvida',
  'todos-votaram': '🗳️ Todos votaram',
};

function CommentList({ comments }: { comments: any[] }) {
  if (!comments.length) return null;
  return <div className="report-comments">{comments.map((comment) => <p key={comment.id}><b>{comment.author}</b><small>· {comment.type}</small><span>{comment.text}</span></p>)}</div>;
}

function RoundDetail({ rounds }: { rounds: any[] }) {
  if (!rounds.length) return null;
  return <div className="report-rounds">{rounds.map((round) => <span key={round.number}>Rodada {round.number}: {round.votes} voto(s) · {round.durationSeconds ?? 0}s</span>)}</div>;
}

export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (id) getReport(id).then(setReport).catch((reason: Error) => setError(reason.message)); }, [id]);
  if (error) return <main className="report-page"><p role="alert">{error}</p><Link to="/">Voltar</Link></main>;
  if (!report) return <main className="report-page"><p>Carregando relatorio...</p></main>;
  const summary = report.summary ?? {};
  const stories = summary.stories ?? [];
  return (
    <main className="report-page">
      <div className="report-card">
        <Link to="/">Voltar</Link>
        <h1>Relatório da sessão</h1>
        <p className="report-muted">Sala {summary.roomName ?? `#${report.roomId}`}{summary.roomCode ? ` · código ${summary.roomCode}` : ''} · {new Date(report.generatedAt ?? summary.generatedAt).toLocaleString('pt-BR')}</p>
        <div className="report-achievements">{(summary.achievements ?? []).map((achievement: string) => <span key={achievement}>{BADGE_LABELS[achievement] ?? achievement}</span>)}</div>
        <h2>Histórias</h2>
        <div className="report-stories">{stories.map((story: any) => <article key={story.id}><div className="report-story-head"><strong>{story.title}</strong><span>{story.status}</span><b>{story.finalValue ?? '-'}</b><small>{story.rounds ?? 0} rodada(s) · {story.totalSeconds ?? 0}s</small></div><RoundDetail rounds={story.roundsDetail ?? []} /><CommentList comments={story.comments ?? []} /></article>)}</div>
        <h2>Participação</h2>
        <div className="report-participation">{(summary.participation ?? []).map((participant: any) => <article key={participant.participantId}><strong>{participant.name ?? participant.participantId}</strong><span>{participant.votes} votos</span><small>{participant.comments} comentários</small></article>)}</div>
        <div className="report-actions"><button className="primary" type="button" onClick={() => downloadCsv(report.id, report.roomId).catch((reason: Error) => setError(reason.message))}>Baixar CSV</button><button className="secondary" type="button" onClick={() => downloadPdf(report.id, report.roomId).catch((reason: Error) => setError(reason.message))}>Baixar PDF</button></div>
      </div>
    </main>
  );
}