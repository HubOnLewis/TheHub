import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { trackEvent } from '../analytics/index.js';
import { storeReferralCode, useReferralsStore } from '../store/referralsStore.js';
import BrandLoader from '../components/BrandLoader.js';

const DEFAULT_INQUIRY_URL = '/login';

export default function ReferralRedirect() {
  const { referralCode } = useParams<{ referralCode: string }>();
  const navigate = useNavigate();
  const findByCode = useReferralsStore(s => s.findByCode);
  const recordClick = useReferralsStore(s => s.recordClick);

  useEffect(() => {
    if (!referralCode) {
      navigate(DEFAULT_INQUIRY_URL, { replace: true });
      return;
    }

    const code = referralCode.trim();
    storeReferralCode(code);
    recordClick(code);

    trackEvent('referral_link_opened', { referral_code: code });

    const link = findByCode(code);
    const target = link?.targetUrl ?? DEFAULT_INQUIRY_URL;

    const timer = window.setTimeout(() => {
      if (target.startsWith('http')) {
        window.location.href = target;
      } else {
        navigate(target, { replace: true });
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [referralCode, navigate, findByCode, recordClick]);

  return <BrandLoader message="Redirecting…" showStatusRotation={false} />;
}
