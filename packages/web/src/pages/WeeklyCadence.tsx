import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Spinner } from '../components/ui/index.js';
import { useRepScorecard, useRepScorecards, useWeeklyCadenceMutations, useWeeklyCadenceReviews } from '../hooks/useLeadership.js';

function mondayRange(anchor: Date) {
  const d = new Date(anchor);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  return { weekStart: d.toISOString().slice(0, 10), weekEnd: end.toISOString().slice(0, 10) };
}

export default function WeeklyCadence() {
  const defaultRange = mondayRange(new Date());
  const [sp, setSp] = useSearchParams();
  const ownerUserId = sp.get('ownerUserId') ?? '';
  const weekStart = sp.get('weekStart') ?? defaultRange.weekStart;
  const weekEnd = sp.get('weekEnd') ?? defaultRange.weekEnd;
  const [summary, setSummary] = useState('');
  const [priorities, setPriorities] = useState('');
  const [risks, setRisks] = useState('');
  const [commitments, setCommitments] = useState('');
  const reps = useRepScorecards({ activeOnly: 1, days: 30 });
  const scorecard = useRepScorecard(ownerUserId || null, 30);
  const reviews = useWeeklyCadenceReviews({
    ownerUserId: ownerUserId || undefined,
    weekStart,
    weekEnd,
    limit: 1,
    page: 1,
  });
  const mutations = useWeeklyCadenceMutations();

  const existing = reviews.data?.data?.[0];
  const selectedRepName = useMemo(
    () => reps.data?.find(r => r.ownerUserId === ownerUserId)?.ownerName ?? ownerUserId,
    [reps.data, ownerUserId],
  );

  if (reps.isLoading || scorecard.isLoading || reviews.isLoading) {
    return <div style={{ padding: 60, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}><Spinner /> <span>Loading…</span></div>;
  }

  const onSave = async () => {
    if (!ownerUserId) return;
    const payload = {
      ownerUserId,
      ownerName: selectedRepName || undefined,
      weekStart,
      weekEnd,
      summary: summary || undefined,
      priorities: priorities.split('\n').map(s => s.trim()).filter(Boolean),
      risks: risks.split('\n').map(s => s.trim()).filter(Boolean),
      commitments: commitments.split('\n').map(s => s.trim()).filter(Boolean),
    };
    if (existing?._id) {
      await mutations.update.mutateAsync({ id: existing._id, payload });
    } else {
      await mutations.create.mutateAsync(payload as any);
    }
  };

  const s = scorecard.data;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Weekly Cadence</h1>
          <div className="page-subtitle">Structured weekly rep operating review and coaching record</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 180px 180px', gap: 10 }}>
        <div>
          <label className="form-label">Rep</label>
          <select className="form-select" value={ownerUserId} onChange={e => setSp(prev => { prev.set('ownerUserId', e.target.value); return prev; })}>
            <option value="">Select rep</option>
            {(reps.data ?? []).map(r => <option key={r.ownerUserId} value={r.ownerUserId}>{r.ownerName ?? r.ownerUserId}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Week start</label>
          <input className="form-input" type="date" value={weekStart} onChange={e => setSp(prev => { prev.set('weekStart', e.target.value); return prev; })} />
        </div>
        <div>
          <label className="form-label">Week end</label>
          <input className="form-input" type="date" value={weekEnd} onChange={e => setSp(prev => { prev.set('weekEnd', e.target.value); return prev; })} />
        </div>
      </div>

      {ownerUserId && s ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-cond)', fontWeight: 800, marginBottom: 8 }}>{s.ownerName ?? s.ownerUserId} snapshot (30d)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: 8 }}>
            <div className="stat-card"><div className="stat-label">Overdue Follow-ups</div><div className="stat-value">{s.followUpMetrics.overdue}</div></div>
            <div className="stat-card"><div className="stat-label">Critical Deals</div><div className="stat-value">{s.dealMetrics.criticalDeals}</div></div>
            <div className="stat-card"><div className="stat-label">Low-Conf Late Stage</div><div className="stat-value">{s.forecastMetrics.lowConfidenceLateStageDeals}</div></div>
            <div className="stat-card"><div className="stat-label">Needs Review</div><div className="stat-value">{s.forecastMetrics.dealsNeedingManagementReview}</div></div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn btn-secondary" to={`/my-work?ownerUserId=${encodeURIComponent(ownerUserId)}&overdueOnly=1`}>Overdue Follow-ups</Link>
            <Link className="btn btn-secondary" to={`/pipeline-pressure?ownerUserId=${encodeURIComponent(ownerUserId)}&pressureLevel=critical`}>Critical Deals</Link>
            <Link className="btn btn-secondary" to={`/forecast-review?ownerUserId=${encodeURIComponent(ownerUserId)}&confidence=low`}>Low-Confidence Late Stage</Link>
            <Link className="btn btn-secondary" to={`/forecast-review?ownerUserId=${encodeURIComponent(ownerUserId)}&needsManagementReview=1`}>Needs Review Queue</Link>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div style={{ fontFamily: 'var(--font-cond)', fontWeight: 800, marginBottom: 8 }}>Weekly Management Review</div>
        <label className="form-label">Summary</label>
        <textarea className="form-input" rows={3} value={summary} onChange={e => setSummary(e.target.value)} placeholder={existing?.summary ?? 'Weekly narrative summary'} />
        <label className="form-label" style={{ marginTop: 8 }}>Priorities (one per line)</label>
        <textarea className="form-input" rows={3} value={priorities} onChange={e => setPriorities(e.target.value)} placeholder={(existing?.priorities ?? []).join('\n')} />
        <label className="form-label" style={{ marginTop: 8 }}>Risks (one per line)</label>
        <textarea className="form-input" rows={3} value={risks} onChange={e => setRisks(e.target.value)} placeholder={(existing?.risks ?? []).join('\n')} />
        <label className="form-label" style={{ marginTop: 8 }}>Commitments (one per line)</label>
        <textarea className="form-input" rows={3} value={commitments} onChange={e => setCommitments(e.target.value)} placeholder={(existing?.commitments ?? []).join('\n')} />
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-primary" disabled={!ownerUserId || mutations.create.isPending || mutations.update.isPending} onClick={onSave}>
            {existing?._id ? 'Update Weekly Review' : 'Save Weekly Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
