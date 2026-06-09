export type MarketingBlastStatus = 'draft';
export type MarketingBlastChannel = 'email' | 'sms';

export interface MarketingBlastDraft {
  id: string;
  name: string;
  audienceSource: string;
  channels: MarketingBlastChannel[];
  subject: string;
  body: string;
  status: MarketingBlastStatus;
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}
