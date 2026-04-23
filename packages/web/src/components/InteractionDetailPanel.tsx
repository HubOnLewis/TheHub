// packages/web/src/components/InteractionDetailPanel.tsx
import { useEffect, useState } from 'react';
import { INTERACTION_OUTCOMES, INTERACTION_TYPES, INTERACTION_DIRECTIONS } from '@mtte-core/shared';
import type { PatchInteractionRequestPayload } from '@mtte-core/shared';
import { EmptyState, Spinner } from './ui/index.js';
import {
  useInteraction, useAddInteractionAttachment, useUpdateInteraction, useRemoveInteractionAttachment,
} from '../hooks/useInteractions.js';
import AttachmentUploader from './AttachmentUploader.js';

const fmt = (d: string) => new Date(d).toLocaleString();

interface Props {
  id:         string | null;
  onClose:    () => void;
  currentUserId: string;
  isAdmin:    boolean;
  companyId:  string;
  companyName: string;
  dealTitles?: Map<string, string>;
}

const panelStyle: React.CSSProperties = {
  position:   'fixed',
  top:        0,
  right:      0,
  width:      'min(440px, 100vw)',
  height:     '100vh',
  maxHeight:  '100dvh',
  background: 'var(--card-bg, #1a1d24)',
  borderLeft: '1px solid var(--border)',
  zIndex:     200,
  display:    'flex',
  flexDirection: 'column',
  boxShadow:  '-4px 0 24px rgba(0,0,0,0.35)',
};

export default function InteractionDetailPanel({
  id, onClose, currentUserId, isAdmin, companyId, companyName, dealTitles = new Map(),
}: Props) {
  const { data: live, isLoading, refetch } = useInteraction(id);
  const update = useUpdateInteraction(companyId);
  const addAtt = useAddInteractionAttachment(companyId);
  const removeAtt = useRemoveInteractionAttachment(companyId);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<PatchInteractionRequestPayload>({});
  const [localFiles, setLocalFiles] = useState<File[]>([]);

  const row = live;

  useEffect(() => {
    if (row) {
      setDraft({
        summary:   row.summary,
        body:      row.body,
        outcome:  row.outcome as PatchInteractionRequestPayload['outcome'],
        status:   row.status as 'open' | 'completed',
        type:     row.type as PatchInteractionRequestPayload['type'],
        direction: row.direction as PatchInteractionRequestPayload['direction'],
        followUpAt: row.followUpAt,
        ownerUserId: row.ownerUserId,
      });
    }
  }, [row]);

  useEffect(() => {
    setEdit(false);
    setLocalFiles([]);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id, onClose]);

  if (!id) return null;

  const isOwner   = row?.ownerUserId === currentUserId;
  const canEdit   = isOwner || isAdmin;

  const save = async () => {
    if (!id) return;
    await update.mutateAsync({ id, body: draft });
    setEdit(false);
    void refetch();
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 199,
        }}
        aria-hidden
      />
      <aside style={panelStyle} role="dialog" aria-label="Interaction detail">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Interaction</span>
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <div style={{ overflow: 'auto', flex: 1, padding: 16 }}>
          {isLoading && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Spinner /><span className="text-muted">Loading…</span></div>
          )}
          {!isLoading && !row && <EmptyState message="Not found" />}

          {row && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{companyName}</div>
              {edit && canEdit ? (
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Summary</label>
                  <input className="form-input" value={draft.summary ?? ''} onChange={e => setDraft(d => ({ ...d, summary: e.target.value }))} />
                </div>
              ) : (
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800 }}>{row.summary}</h3>
              )}

              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
                {fmt(row.createdAt)} · Created by {row.createdByName} · Owner: {row.ownerName} · {row.type} / {row.direction}
              </div>
              {row.lastEditedAt && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Last edited {fmt(row.lastEditedAt)} by {row.lastEditedByName ?? row.lastEditedByUserId}
                </div>
              )}
              {row.completedAt && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Completed {fmt(row.completedAt)} by {row.completedByName ?? row.completedByUserId}
                </div>
              )}

              {edit && canEdit ? (
                <>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Type</label>
                    <select
                      className="form-select"
                      value={draft.type}
                      onChange={e => setDraft(d => ({ ...d, type: e.target.value as NonNullable<typeof d.type> }))}
                    >
                      {INTERACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Direction</label>
                    <select
                      className="form-select"
                      value={draft.direction}
                      onChange={e => setDraft(d => ({ ...d, direction: e.target.value as never }))}
                    >
                      {INTERACTION_DIRECTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Body</label>
                    <textarea className="form-textarea" rows={5} value={draft.body ?? ''} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Outcome</label>
                    <select
                      className="form-select"
                      value={draft.outcome}
                      onChange={e => setDraft(d => ({ ...d, outcome: e.target.value as never }))}
                    >
                      {INTERACTION_OUTCOMES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={draft.status}
                      onChange={e => setDraft(d => ({ ...d, status: e.target.value as 'open' | 'completed' }))}
                    >
                      <option value="open">Open</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  {isAdmin && (
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label className="form-label">Owner User ID</label>
                      <input
                        className="form-input"
                        value={(draft.ownerUserId as string | undefined) ?? ''}
                        onChange={e => setDraft(d => ({ ...d, ownerUserId: e.target.value || null }))}
                        placeholder="Reassign owner (admin only)"
                      />
                    </div>
                  )}
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Follow-up</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={draft.followUpAt ? toLocal(draft.followUpAt as string) : ''}
                      onChange={e => {
                        const v = e.target.value;
                        setDraft(d => ({ ...d, followUpAt: v ? new Date(v).toISOString() : null }));
                      }}
                    />
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 11, marginTop: 4 }} onClick={() => setDraft(d => ({ ...d, followUpAt: null }))}>
                      Clear follow-up
                    </button>
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-primary)', marginBottom: 12, whiteSpace: 'pre-wrap' }}>{row.body}</p>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <span className="badge badge-approved" style={{ textTransform: 'capitalize' }}>{row.outcome.replace(/_/g, ' ')}</span>
                {row.status === 'open' && <span className="badge badge-pendingapproval">open</span>}
                {row.status === 'completed' && <span className="badge badge-delivered">completed</span>}
                {row.isOverdue && <span className="badge" style={{ background: 'var(--red)' }}>overdue</span>}
                {row.ownerName && <span className="badge">{row.ownerName}</span>}
              </div>

              {row.relatedDealId && (
                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Linked deal: </span>
                  {dealTitles.get(row.relatedDealId) ?? row.relatedDealId}
                </div>
              )}
              {row.parentInteractionId && (
                <div style={{ fontSize: 12, marginBottom: 8 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Related to previous interaction: </span>
                  {row.parentInteractionId}
                </div>
              )}

              {row.metadata && Object.keys(row.metadata).length > 0 && (
                <details style={{ fontSize: 12, marginBottom: 10 }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>Metadata</summary>
                  <pre style={{ margin: '6px 0 0', overflow: 'auto', fontSize: 11, background: 'var(--bg)', padding: 8, borderRadius: 4 }}>{JSON.stringify(row.metadata, null, 2)}</pre>
                </details>
              )}

              {row.aiInsights && Object.keys(row.aiInsights).length > 0 && (
                <details style={{ fontSize: 12, marginBottom: 10 }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>AI insights (phase 2)</summary>
                  <pre style={{ margin: '6px 0 0', overflow: 'auto', fontSize: 11, background: 'var(--bg)', padding: 8, borderRadius: 4 }}>{JSON.stringify(row.aiInsights, null, 2)}</pre>
                </details>
              )}

              {row.attachments.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Attachments</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {row.attachments.map(a => (
                      <div key={a.id}>
                        {a.type === 'image' ? (
                          <a href={a.url} target="_blank" rel="noreferrer">
                            <img src={a.url} alt={a.fileName} style={{ maxWidth: '100%', borderRadius: 8, maxHeight: 240, objectFit: 'contain' }} />
                          </a>
                        ) : (
                          <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--red)' }}>📄 {a.fileName}</a>
                        )}
                        <div style={{ fontSize: 10, color: 'var(--text-light)' }}>
                          {a.originalFileName || a.fileName} · {(a.sizeBytes / 1024).toFixed(1)} KB · {a.mimeType}
                        </div>
                        {edit && canEdit && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ fontSize: 11, marginTop: 4 }}
                            onClick={async () => {
                              if (!window.confirm('Remove this attachment?')) return;
                              await removeAtt.mutateAsync({ id: row._id, attachmentId: a.id });
                              void refetch();
                            }}
                          >
                            Remove attachment
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {canEdit && !edit && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEdit(true)}>Edit</button>
                  {canEdit && row.status === 'open' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={async () => {
                        await update.mutateAsync({ id: row._id, body: { status: 'completed' } });
                        void refetch();
                      }}
                    >
                      Mark follow-up complete
                    </button>
                  )}
                </div>
              )}
              {canEdit && edit && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="button" className="btn btn-primary" onClick={save} disabled={update.isPending}>
                    {update.isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setEdit(false); if (row) setDraft({ summary: row.summary, body: row.body, outcome: row.outcome as never, status: row.status as never, type: row.type as never, direction: row.direction as never, followUpAt: row.followUpAt, ownerUserId: row.ownerUserId }); }}>Cancel</button>
                </div>
              )}

              {canEdit && !edit && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Add attachment</div>
                  <AttachmentUploader
                    files={localFiles}
                    onChange={setLocalFiles}
                    disabled={addAtt.isPending}
                  />
                  {localFiles.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ marginTop: 8 }}
                      disabled={addAtt.isPending}
                      onClick={async () => {
                        for (const f of localFiles) {
                          await addAtt.mutateAsync({ id: row._id, file: f });
                        }
                        setLocalFiles([]);
                        void refetch();
                      }}
                    >
                      {addAtt.isPending ? 'Uploading…' : 'Upload'}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function toLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
