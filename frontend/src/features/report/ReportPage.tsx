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

function RoundVoteDetails({ round }: { round: any }) {
  const details = round.voteDetails ?? [];
  if (!details.length) return <span>Rodada {round.number}: {round.votes} voto(s) · {round.durationSeconds ?? 0}s</span>;
  return (
    <span>
      Rodada {round.number}: {details.map((vote: any) => (
        <span key={`${round.number}-${vote.participantName}`} className="report-vote-detail">
          {vote.participantName} → {vote.value}{vote.justification ? ` · "${vote.justification}"` : ''}
        </span>
      ))}
    </span>
  );
}

function RoundDetail({ rounds }: { rounds: any[] }) {
  if (!rounds.length) return null;
  return <div className="report-rounds">{rounds.map((round) => <RoundVoteDetails round={round} key={round.number} />)}</div>;
}

function StoryInsights({ insights }: { insights?: any }) {
  if (!insights) return null;
  return (
    <div className="report-insights">
      <p><b>📝 Síntese.</b> {insights.summary}</p>
      {insights.suggestedTasks?.length > 0 && (
        <div className="report-task-chips">
          <small>✅ Ideias de tasks</small>
          {insights.suggestedTasks.map((task: string) => <span key={task} className="report-task-chip">{task}</span>)}
        </div>
      )}
    </div>
  );
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
  const insights = summary.insights;
  const roomNotes = summary.roomNotes ?? [];
  const overallInsight = insights?.overall;
  return (
    <main className="report-page">
      <div className="report-card">
        <Link to="/">Voltar</Link>
        <h1>Relatório da sessão</h1>
        <p className="report-muted">Sala {summary.roomName ?? `#${report.roomId}`}{summary.roomCode ? ` · código ${summary.roomCode}` : ''} · {new Date(report.generatedAt ?? summary.generatedAt).toLocaleString('pt-BR')}</p>
        <div className="report-achievements">{(summary.achievements ?? []).map((achievement: string) => <span key={achievement}>{BADGE_LABELS[achievement] ?? achievement}</span>)}</div>
        <h2>Histórias</h2>
        <div className="report-stories">{stories.map((story: any) => <article key={story.id}><div className="report-story-head"><strong>{story.title}</strong><span>{story.status}</span><b>{story.finalValue ?? '-'}</b><small>{story.rounds ?? 0} rodada(s) · {story.totalSeconds ?? 0}s</small></div><RoundDetail rounds={story.roundsDetail ?? []} /><CommentList comments={story.comments ?? []} /><StoryInsights insights={insights?.perStory?.find((item: any) => item.storyId === story.id)} /></article>)}</div>
        {overallInsight && (
          <section className="report-overall">
            <h2>Resumo da sessão</h2>
            <p>{overallInsight.summary}</p>
            {overallInsight.suggestedTasks?.length > 0 && (
              <div className="report-task-chips">
                <small>✅ Principais ideias de tasks</small>
                {overallInsight.suggestedTasks.map((task: string) => <span key={task} className="report-task-chip">{task}</span>)}
              </div>
            )}
          </section>
        )}
        <h2>Participação</h2>
        <div className="report-participation">{(summary.participation ?? []).map((participant: any) => <article key={participant.participantId}><strong>{participant.name ?? participant.participantId}</strong><span>{participant.votes} votos</span><small>{participant.comments} comentários</small></article>)}</div>
        {roomNotes.length > 0 && (
          <section className="report-room-notes">
            <h2>🧭 Anotações da mesa</h2>
            {roomNotes.map((note: any) => <p key={note.id}><b>{note.author}</b><small>· {note.role}</small><span>{note.text}</span></p>)}
          </section>
        )}
        <div className="report-actions"><button className="primary" type="button" onClick={() => downloadCsv(report.id, summary.roomCode).catch((reason: Error) => setError(reason.message))}>Baixar CSV</button><button className="secondary" type="button" onClick={() => downloadPdf(report.id, summary.roomCode).catch((reason: Error) => setError(reason.message))}>Baixar PDF</button></div>
      </div>
    </main>
  );
}