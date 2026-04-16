// packages/web/src/pages/CompanyDetail.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany, useCompanyActivities } from '../hooks/useCompanies.js';
import { EmptyState, Spinner, Pagination } from '../components/ui/index.js';
import { timeAgo } from '@mtte-core/shared';
import type { ActivityType } from '@mtte-core/shared';

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call_out:  'Outgoing Call',
  call_in:   'Incoming Call',
  email_out: 'Outgoing Email',
  email_in:  'Incoming Email',
  text_out:  'Outgoing Text',
  text_in:   'Incoming Text',
  visit:     'Visit',
  event:     'Event',
  other:     'Other',
};

const ACTIVITY_TYPE_COLOR: Record<ActivityType, string> = {
  call_out:  '#3b82f6',
  call_in:   '#22c55e',
  email_out: '#8b5cf6',
  email_in:  '#a78bfa',
  text_out:  '#f59e0b',
  text_in:   '#fbbf24',
  visit:     'var(--red)',
  event:     '#06b6d4',
  other:     'var(--text-secondary)',
};

export default function CompanyDetail() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const [actPage, setActPage] = useState(1);

  const { data: company,       isLoading: companyLoading }  = useCompany(id!);
  const { data: activitiesData, isLoading: actLoading }     = useCompanyActivities(id!, { page: actPage, limit: 20 });

  const activities = (activitiesData as any)?.data  ?? [];
  const actTotal   = (activitiesData as any)?.total ?? 0;
  const actPages   = (activitiesData as any)?.pages ?? 1;

  if (companyLoading) {
    return (
      <div style={{ padding: 40, display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center' }}>
        <Spinner /><span className="text-muted">Loading…</span>
      </div>
    );
  }

  if (!company) {
    return <EmptyState message="Company not found" sub="It may have been removed or you may not have access." />;
  }

  const c = company as any;

  return (
    <div>
      {/* Back nav */}
      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 0', color: 'var(--text-secondary)' }} onClick={() => navigate('/companies')}>
          ← Companies
        </button>
      </div>

      {/* Company header card */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-cond)', fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
              {c.name}
              {c.isStub && (
                <span className="badge" style={{ marginLeft: 10, fontSize: 11, background: 'var(--border)', color: 'var(--text-secondary)', verticalAlign: 'middle' }}>
                  stub
                </span>
              )}
            </h2>
            {(c.address?.city || c.address?.state) && (
              <div className="text-sm text-muted">
                {[c.address?.street, c.address?.city, c.address?.state, c.address?.postalCode]
                  .filter(Boolean).join(', ')}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'right' }}>
            {c.phone && (
              <div className="text-sm">{c.phone}</div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Source: {c.source}
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: 'flex', gap: 24, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-secondary)', marginBottom: 2 }}>
              Last Contact
            </div>
            <div style={{ fontFamily: 'var(--font-cond)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              {c.daysSinceLastContact != null ? `${c.daysSinceLastContact}d ago` : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-secondary)', marginBottom: 2 }}>
              Activities
            </div>
            <div style={{ fontFamily: 'var(--font-cond)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              {actTotal}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-secondary)', marginBottom: 2 }}>
              Added
            </div>
            <div style={{ fontFamily: 'var(--font-cond)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              {timeAgo(c.createdAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Activity timeline */}
      <div style={{ marginBottom: 8, fontFamily: 'var(--font-cond)', fontWeight: 700, fontSize: 14, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>
        Activity History
      </div>

      {actLoading ? (
        <div style={{ padding: 32, display: 'flex', justifyContent: 'center', gap: 10, alignItems: 'center' }}>
          <Spinner /><span className="text-muted">Loading activities…</span>
        </div>
      ) : activities.length === 0 ? (
        <EmptyState message="No activities" sub="Activities will appear here after the VOZE import." />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activities.map((a: any) => {
              const typeLabel = ACTIVITY_TYPE_LABELS[a.activityType as ActivityType] ?? a.activityTypeRaw;
              const typeColor = ACTIVITY_TYPE_COLOR[a.activityType as ActivityType] ?? 'var(--text-secondary)';
              const tagKeys   = Object.keys(a.tags ?? {}).filter(k => a.tags[k]);

              return (
                <div key={a._id} className="card" style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        display:      'inline-block',
                        padding:      '2px 8px',
                        borderRadius: 4,
                        fontSize:     11,
                        fontWeight:   700,
                        background:   `${typeColor}22`,
                        color:        typeColor,
                        whiteSpace:   'nowrap',
                      }}>
                        {typeLabel}
                      </span>
                      {a.contactNameRaw && (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {a.contactNameRaw}
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-secondary)' }}>
                      <div>{new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      <div>{a.createdByName}</div>
                    </div>
                  </div>

                  {a.body && (
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55 }}>
                      {a.body}
                    </p>
                  )}

                  {tagKeys.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {tagKeys.map(k => (
                        <span key={k} style={{
                          display:      'inline-block',
                          padding:      '1px 7px',
                          borderRadius: 4,
                          fontSize:     10,
                          fontWeight:   600,
                          background:   'var(--border)',
                          color:        'var(--text-secondary)',
                        }}>
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12 }}>
            <Pagination page={actPage} pages={actPages} total={actTotal} onPage={setActPage} />
          </div>
        </>
      )}
    </div>
  );
}
