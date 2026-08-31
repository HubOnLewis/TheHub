/**
 * Outbound email boundary.
 * Production ships with the stub — no SMTP, no Gmail, no live send.
 * A Gmail / hubonlewis.com adapter can implement this later without changing callers.
 */

export type OutboundEmail = {
  to: string;
  subject: string;
  body: string;
  eventId: string;
  replyTo?: string;
  templateKey?: string;
};

export type EmailSendResult = {
  ok: boolean;
  provider: 'stub';
  status: 'stubbed';
  messageId: string;
  at: string;
  to: string;
  subject: string;
};

export interface EmailProvider {
  send(message: OutboundEmail): Promise<EmailSendResult>;
}

export class StubEmailProvider implements EmailProvider {
  async send(message: OutboundEmail): Promise<EmailSendResult> {
    return {
      ok: true,
      provider: 'stub',
      status: 'stubbed',
      messageId: `stub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      to: message.to,
      subject: message.subject,
    };
  }
}

let instance: EmailProvider = new StubEmailProvider();

/** Tests and future adapters swap the provider; production stays on the stub. */
export function getEmailProvider(): EmailProvider {
  return instance;
}

export function setEmailProvider(provider: EmailProvider): void {
  instance = provider;
}

export function resetEmailProvider(): void {
  instance = new StubEmailProvider();
}
