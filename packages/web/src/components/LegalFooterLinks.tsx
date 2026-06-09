import { Link } from 'react-router-dom';
import { HUB_PUBLIC_CONTACT_EMAIL } from '@hub-crm/shared';

interface LegalFooterLinksProps {
  className?: string;
  showContact?: boolean;
}

export default function LegalFooterLinks({ className = '', showContact = true }: LegalFooterLinksProps) {
  return (
    <nav className={`legal-footer-links ${className}`.trim()} aria-label="Legal and contact">
      <Link to="/privacy">Privacy Policy</Link>
      <span aria-hidden>·</span>
      <Link to="/terms">Terms of Service</Link>
      {showContact && (
        <>
          <span aria-hidden>·</span>
          <a href={`mailto:${HUB_PUBLIC_CONTACT_EMAIL}`}>{HUB_PUBLIC_CONTACT_EMAIL}</a>
        </>
      )}
    </nav>
  );
}
