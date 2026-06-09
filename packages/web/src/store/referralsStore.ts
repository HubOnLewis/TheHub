import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ReferralIncentiveType, ReferralLink } from '@hub-crm/shared';

const REFERRAL_STORAGE_KEY = 'hub_referral_code';

interface ReferralsStore {
  links: ReferralLink[];
  addLink: (input: {
    referralCode: string;
    referrerName: string;
    referrerEmail?: string;
    incentiveType: ReferralIncentiveType;
    targetUrl: string;
    notes?: string;
  }) => string;
  recordClick: (referralCode: string) => void;
  recordConversion: (referralCode: string) => void;
  findByCode: (code: string) => ReferralLink | undefined;
  getTotalClicks: () => number;
  getTotalConversions: () => number;
}

function uid(): string {
  return `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function storeReferralCode(code: string): void {
  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, code);
    document.cookie = `${REFERRAL_STORAGE_KEY}=${encodeURIComponent(code)};path=/;max-age=${60 * 60 * 24 * 30};SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function getStoredReferralCode(): string | null {
  try {
    return localStorage.getItem(REFERRAL_STORAGE_KEY);
  } catch {
    return null;
  }
}

export const useReferralsStore = create<ReferralsStore>()(
  persist(
    (set, get) => ({
      links: [],

      addLink(input) {
        const id = uid();
        const link: ReferralLink = {
          id,
          ...input,
          createdAt: new Date().toISOString(),
          clickCount: 0,
          conversionCount: 0,
        };
        set(s => ({ links: [link, ...s.links] }));
        return id;
      },

      recordClick(referralCode) {
        set(s => ({
          links: s.links.map(l =>
            l.referralCode === referralCode ? { ...l, clickCount: l.clickCount + 1 } : l,
          ),
        }));
      },

      recordConversion(referralCode) {
        set(s => ({
          links: s.links.map(l =>
            l.referralCode === referralCode ? { ...l, conversionCount: l.conversionCount + 1 } : l,
          ),
        }));
      },

      findByCode(code) {
        return get().links.find(l => l.referralCode.toLowerCase() === code.toLowerCase());
      },

      getTotalClicks() {
        return get().links.reduce((n, l) => n + l.clickCount, 0);
      },

      getTotalConversions() {
        return get().links.reduce((n, l) => n + l.conversionCount, 0);
      },
    }),
    { name: 'hub-crm-referrals' },
  ),
);
