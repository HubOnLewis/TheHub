import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '../../components/BrandLogo.js';
import LegalFooterLinks from '../../components/LegalFooterLinks.js';
import { BRAND } from '../../branding/tokens.js';
import { HUB_PUBLIC_CONTACT_EMAIL } from '@hub-crm/shared';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

export default function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="legal-page">
      <header className="legal-page__header">
        <Link to="/login" className="legal-page__brand">
          <BrandLogo size="md" />
        </Link>
        <p className="legal-page__venue">
          {BRAND.venueName} · {BRAND.venueLocation}
        </p>
      </header>
      <main className="legal-page__main">
        <h1>{title}</h1>
        <p className="legal-page__updated">Last updated: {lastUpdated}</p>
        <div className="legal-page__body">{children}</div>
        <p className="legal-page__contact">
          Questions? Contact us at{' '}
          <a href={`mailto:${HUB_PUBLIC_CONTACT_EMAIL}`}>{HUB_PUBLIC_CONTACT_EMAIL}</a>.
        </p>
      </main>
      <footer className="legal-page__footer">
        <LegalFooterLinks showContact={false} />
        <Link to="/login" className="legal-page__back">
          ← Back to sign in
        </Link>
      </footer>
    </div>
  );
}
