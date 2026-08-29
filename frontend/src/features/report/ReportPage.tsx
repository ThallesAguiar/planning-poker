import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { downloadCsv, downloadPdf, getReport } from './report-api';

export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (id) getReport(id).then(setReport).catch((reason: Error) => setError(reason.message)); }, [id]);
  if (error) return <main className="report-page"><p role="alert">{error}</p><Link to="/">Voltar</Link></main>;
  if (!report) return <main className="report-page"><p>Carregando relatorio...</p></main>;
  const summary = report.summary ?? {};
  return <main className="report-page"><div className="report-card"><Link to="/">Voltar</Link><h1>Relatorio da sessao</h1><p className="report-muted">Sala {report.roomId} · {new Date(report.generatedAt).toLocaleString('pt-BR')}</p><div className="report-stories">{(summary.stories ?? []).map((story: any) => <article key={story.id}><strong>{story.title}</strong><span>{story.status}</span><b>{story.finalValue ?? '-'}</b><small>{story.rounds ?? 0} rodada(s) · {story.totalSeconds ?? 0}s</small></article>)}</div><h2>Participacao</h2><div className="report-participation">{(summary.participation ?? []).map((participant: any) => <article key={participant.participantId}><strong>{participant.participantId}</strong><span>{participant.votes} votos</span><small>{participant.comments} comentarios</small></article>)}</div><div className="report-achievements">{(summary.achievements ?? []).map((achievement: any) => <span key={achievement.id}>{achievement.label}</span>)}</div><div className="report-actions"><button className="primary" type="button" onClick={() => downloadCsv(report.id, report.roomId).catch((reason: Error) => setError(reason.message))}>Baixar CSV</button><button className="secondary" type="button" onClick={() => downloadPdf(report.id, report.roomId).catch((reason: Error) => setError(reason.message))}>Baixar PDF</button></div></div></main>;
}
