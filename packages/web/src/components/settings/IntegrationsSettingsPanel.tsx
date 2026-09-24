import MailchimpSettingsPanel from './MailchimpSettingsPanel.js';
import AiModelSettingsPanel from './AiModelSettingsPanel.js';
import { SMS_PROVIDER_STATUS, SMS_TEMPLATES } from '../../integrations/sms/smsDemoAdapter.js';
import { useAppStore } from '../../store/index.js';
import { isSuperAdminRole } from '../../config/productionAlphaNav.js';

export default function IntegrationsSettingsPanel() {
  const role = useAppStore(s => s.user?.role);
  return (
    <div className="settings-deep settings-integrations-stack">
      {isSuperAdminRole(role) ? (
        <AiModelSettingsPanel />
      ) : (
        <section className="card settings-provider-card" style={{ marginTop: 20 }}>
          <h4>Onsite AI assistant</h4>
          <p className="settings-muted">
            Managed by your system administrator. AI suggestions appear on leads and events when the onsite AI is online.
          </p>
        </section>
      )}
      <MailchimpSettingsPanel />

      <section className="card settings-provider-card" style={{ marginTop: 20 }}>
        <h4>SMS (Twilio)</h4>
        <p>
          Status:{' '}
          <strong>{SMS_PROVIDER_STATUS.configured ? 'Connected' : 'Not configured yet'}</strong>
        </p>
        <p className="settings-muted">
          SMS requires approved Twilio setup. No messages are sent without explicit configuration.
        </p>
        {SMS_TEMPLATES.length > 0 && (
          <p className="settings-muted" style={{ marginTop: 8 }}>
            {SMS_TEMPLATES.length} message templates available when SMS is enabled.
          </p>
        )}
      </section>
    </div>
  );
}
