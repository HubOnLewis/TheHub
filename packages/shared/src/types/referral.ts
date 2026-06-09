export type ReferralIncentiveType = 'cash' | 'discount' | 'custom';

export interface ReferralLink {
  id: string;
  referralCode: string;
  referrerName: string;
  referrerEmail?: string;
  incentiveType: ReferralIncentiveType;
  targetUrl: string;
  createdAt: string;
  clickCount: number;
  conversionCount: number;
  notes?: string;
}
