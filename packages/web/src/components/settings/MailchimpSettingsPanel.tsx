import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import client from '../../api/client.js';
import { Spinner } from '../ui/index.js';

type MailchimpStatus = {
  configured: boolean;
  audienceIdMasked: string | null;
  message: string;
};

type SyncResult = {
  configured: boolean;
  synced: boolean;
  message: string;
};

export default function MailchimpSettingsPanel() {
  const [leadId, setLeadId] = useState('');

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['integrations', 'mailchimp', 'status'],
    queryFn: () => client.get<MailchimpStatus>('/integrations/mailchimp/status').then(r => r.data),
    staleTime: 30_000,
    retry: false,
  });

  const syncLead = useMutation({
    mutationFn: (id: string) =>
      client.post<SyncResult>(`/integrations/mailchimp/sync-lead/${id}`, { tags: ['manual-sync'] }).then(r => r.data),
  });

  return (
    <div className="settings-deep">
      <div className="settings-provider-card card">
        <h4>Mailchimp</h4>
        {isLoading ? (
          <Spinner />
        ) : (
          <>
            <p>
              Status:{' '}
              <strong>{status?.configured ? 'Connected' : 'Not configured yet'}</strong>
            </p>
            {status?.configured && status.audienceIdMasked ? (
              <p className="settings-muted">Audience: {status.audienceIdMasked}</p>
            ) : (
              <p className="settings-muted">Connect Mailchimp in your deployment settings to sync contacts.</p>
            )}
          </>
        )}
        <button type="button" className="btn btn-ghost" style={{ marginTop: 8, fontSize: 12 }} onClick={() => refetch()}>
          Refresh status
        </button>
      </div>

      <p className="settings-compliance">
        Contacts are synced only when explicitly triggered. No automated campaign sends in this build.
      </p>

      <h4 className="settings-autopilot-h4">Sync lead to Mailchimp</h4>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
          <label className="form-label">Lead ID</label>
          <input
            className="form-input"
            value={leadId}
            onChange={e => setLeadId(e.target.value)}
            placeholder="MongoDB lead _id"
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!leadId.trim() || !status?.configured || syncLead.isPending}
          onClick={() => syncLead.mutate(leadId.trim())}
        >
          {syncLead.isPending ? 'Syncing…' : 'Sync lead'}
        </button>
      </div>
      {syncLead.data && (
        <p className="settings-muted" style={{ marginTop: 10 }}>
          {syncLead.data.message}
        </p>
      )}
      {syncLead.isError && (
        <p style={{ color: 'var(--red)', marginTop: 10, fontSize: 13 }}>
          Sync failed — confirm API credentials and lead ID.
        </p>
      )}
    </div>
  );
}
