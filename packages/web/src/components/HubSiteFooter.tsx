import type { ReactNode } from 'react';
import { HUB_PUBLIC_CONTACT_EMAIL } from '@hub-crm/shared';
import { BRAND } from '../branding/tokens.js';
import { HUB_LOGO_ALT, HUB_LOGO_MARK_SRC } from '../branding/logo.js';
import LegalFooterLinks from './LegalFooterLinks.js';

type Props = {
  extra?: ReactNode;
  compact?: boolean;
};

export default function HubSiteFooter({ extra, compact = false }: Props) {
  const year = new Date().getFullYear();

  return (
    <footer className={`hub-site-footer${compact ? ' hub-site-footer--compact' : ''}`}>
      <div className="hub-site-footer__inner">
        <div className="hub-site-footer__brand">
          <img
            src={HUB_LOGO_MARK_SRC}
            alt={HUB_LOGO_ALT}
            className="hub-site-footer__mark"
            width={120}
            height={117}
            decoding="async"
            draggable={false}
          />
          <div className="hub-site-footer__identity">
            <p className="hub-site-footer__name">{BRAND.venueName}</p>
            <p className="hub-site-footer__meta">Event venue · {BRAND.venueLocation}</p>
            <p className="hub-site-footer__meta">1400 N Lewis St, Wichita, KS</p>
            <p className="hub-site-footer__copy">
              © {year} {BRAND.venueName}. All rights reserved.
            </p>
          </div>
        </div>
        <div className="hub-site-footer__links">
          <a href="https://hubonlewis.com" className="hub-site-footer__web">
            hubonlewis.com
          </a>
          <a href={`mailto:${HUB_PUBLIC_CONTACT_EMAIL}`}>{HUB_PUBLIC_CONTACT_EMAIL}</a>
          <LegalFooterLinks className="hub-site-footer__legal" showContact={false} />
          {extra}
        </div>
      </div>
    </footer>
  );
}
