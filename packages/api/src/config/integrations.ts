// packages/api/src/config/integrations.ts
/** Optional integration credentials — never required for API boot */

export interface MailchimpConfig {
  configured: boolean;
  apiKey?: string;
  serverPrefix?: string;
  audienceId?: string;
}

export function getMailchimpConfig(): MailchimpConfig {
  const apiKey = process.env['MAILCHIMP_API_KEY']?.trim();
  const serverPrefix = process.env['MAILCHIMP_SERVER_PREFIX']?.trim();
  const audienceId = process.env['MAILCHIMP_AUDIENCE_ID']?.trim();

  const configured = Boolean(apiKey && serverPrefix && audienceId);

  return {
    configured,
    apiKey: configured ? apiKey : undefined,
    serverPrefix: configured ? serverPrefix : undefined,
    audienceId: configured ? audienceId : undefined,
  };
}

export function maskAudienceId(id: string): string {
  if (id.length <= 6) return '••••••';
  return `${id.slice(0, 4)}••••${id.slice(-4)}`;
}
