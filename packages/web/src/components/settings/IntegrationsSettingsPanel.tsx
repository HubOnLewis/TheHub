import MailchimpSettingsPanel from './MailchimpSettingsPanel.js';
import { SMS_PROVIDER_STATUS, SMS_TEMPLATES } from '../../integrations/sms/smsDemoAdapter.js';

export default function IntegrationsSettingsPanel() {
  return (
    <div className="settings-deep settings-integrations-stack">
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
