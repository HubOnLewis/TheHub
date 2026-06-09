// packages/api/src/services/MailchimpService.ts
import { createHash } from 'node:crypto';
import { getMailchimpConfig, maskAudienceId } from '../config/integrations.js';
import { NotFoundError } from '../errors/index.js';
import type { Db } from 'mongodb';
import type { TenantContext } from '../tenancy/index.js';
import { LeadRepository } from '../repositories/LeadRepository.js';

export interface MailchimpStatus {
  configured: boolean;
  audienceIdMasked: string | null;
  message: string;
}

export interface MailchimpSyncResult {
  configured: boolean;
  synced: boolean;
  message: string;
  mailchimpId?: string;
}

function subscriberHash(email: string): string {
  return createHash('md5').update(email.trim().toLowerCase()).digest('hex');
}

export class MailchimpService {
  getStatus(): MailchimpStatus {
    const cfg = getMailchimpConfig();
    if (!cfg.configured) {
      return {
        configured: false,
        audienceIdMasked: null,
        message: 'Not configured — set MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, and MAILCHIMP_AUDIENCE_ID',
      };
    }
    return {
      configured: true,
      audienceIdMasked: maskAudienceId(cfg.audienceId!),
      message: 'Configured',
    };
  }

  async syncLead(db: Db, ctx: TenantContext, leadId: string, tags: string[] = []): Promise<MailchimpSyncResult> {
    const cfg = getMailchimpConfig();
    if (!cfg.configured) {
      return {
        configured: false,
        synced: false,
        message: 'Not configured',
      };
    }

    const lead = await LeadRepository.findById(db, ctx, leadId);
    if (!lead) throw new NotFoundError('Lead');

    const email = (lead.email as string | undefined)?.trim();
    if (!email) {
      return {
        configured: true,
        synced: false,
        message: 'Lead has no email address',
      };
    }

    const sourceTags = ['hub-crm', `tenant:${ctx.tenantId ?? 'default'}`, ...tags];
    if (lead.source) sourceTags.push(`source:${String(lead.source).toLowerCase().replace(/\s+/g, '-')}`);

    const hash = subscriberHash(email);
    const base = `https://${cfg.serverPrefix}.api.mailchimp.com/3.0`;
    const url = `${base}/lists/${cfg.audienceId}/members/${hash}`;

    const body = {
      email_address: email.toLowerCase(),
      status_if_new: 'subscribed' as const,
      merge_fields: {
        FNAME: String(lead.contact ?? '').split(' ')[0] ?? '',
        LNAME: String(lead.contact ?? '').split(' ').slice(1).join(' ') ?? '',
        COMPANY: String(lead.company ?? ''),
      },
      tags: sourceTags,
    };

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `apikey ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        return {
          configured: true,
          synced: false,
          message: `Mailchimp API error: ${res.status} ${errText.slice(0, 200)}`,
        };
      }

      const data = (await res.json()) as { id?: string };
      return {
        configured: true,
        synced: true,
        message: 'Contact synced to Mailchimp audience',
        mailchimpId: data.id,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return {
        configured: true,
        synced: false,
        message: `Mailchimp request failed: ${msg}`,
      };
    }
  }
}

export const mailchimpService = new MailchimpService();
