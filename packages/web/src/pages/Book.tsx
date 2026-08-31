import { useLayoutEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { VENUE_EVENT_TYPES, VENUE_SPACES } from '@hub-crm/shared';
import BrandLogo from '../components/BrandLogo.js';
import LegalFooterLinks from '../components/LegalFooterLinks.js';
import { BRAND } from '../branding/tokens.js';
import { resolveApiBaseUrl, getApiNetworkErrorMessage } from '../config/apiBaseUrl.js';
import { getApiConfigError } from '../api/client.js';

const BOOKING_SPACES = VENUE_SPACES.filter(s => s !== 'TBD');

type InquiryOk = {
  leadId: string;
  eventId: string;
  portalPath: string;
  portalUrl: string;
  emailStatus?: string;
};

function publicInquiryUrl(): { url: string; configError: string | null } {
  const { baseUrl, configError } = resolveApiBaseUrl();
  if (configError || !baseUrl) return { url: '', configError: configError ?? 'API URL is not configured.' };
  return { url: `${baseUrl.replace(/\/$/, '')}/public/inquiry`, configError: null };
}

function guestConflictMessage(status: number, apiError: string | undefined): string | null {
  if (status === 409) {
    return 'That date is taken for this space. Please pick another.';
  }
  if (apiError && /taken|double-book|already booked|overlaps/i.test(apiError)) {
    return 'That date is taken for this space. Please pick another.';
  }
  return null;
}

export default function BookPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [space, setSpace] = useState<string>(BOOKING_SPACES[0] ?? 'Main Hall');
  const [eventType, setEventType] = useState<string>(VENUE_EVENT_TYPES[0] ?? 'Wedding');
  const [guests, setGuests] = useState('80');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InquiryOk | null>(null);
  const [copied, setCopied] = useState(false);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  const minDate = useMemo(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }, []);

  const copyPortal = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCopied(false);
    const configErr = getApiConfigError();
    if (configErr) {
      setError(configErr);
      return;
    }
    const guestCount = Number(guests);
    if (!name.trim() || !email.trim() || !eventDate || !space || !eventType) {
      setError('Please fill in your name, email, date, space, and event type.');
      return;
    }
    if (!Number.isFinite(guestCount) || guestCount < 1) {
      setError('Please enter a guest count.');
      return;
    }
    const { url, configError } = publicInquiryUrl();
    if (configError || !url) {
      setError(configError ?? 'Cannot reach The Hub API.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          eventDate,
          space,
          eventType,
          guests: guestCount,
        }),
      });
      let body: { error?: string } & Partial<InquiryOk> = {};
      try {
        body = (await res.json()) as { error?: string } & Partial<InquiryOk>;
      } catch {
        body = {};
      }
      if (res.status === 409 || guestConflictMessage(res.status, body.error)) {
        setError(guestConflictMessage(res.status, body.error) ?? 'That date is taken for this space. Please pick another.');
        return;
      }
      if (!res.ok) {
        setError(body.error || (res.status === 429 ? 'Too many inquiries — try again later.' : 'Something went wrong. Please try again.'));
        return;
      }
      if (!body.portalUrl) {
        setError('Inquiry saved, but no portal link came back. Please contact the venue.');
        return;
      }
      setResult({
        leadId: String(body.leadId ?? ''),
        eventId: String(body.eventId ?? ''),
        portalPath: String(body.portalPath ?? ''),
        portalUrl: String(body.portalUrl),
        emailStatus: body.emailStatus,
      });
    } catch (err: unknown) {
      const ax = err as { message?: string; code?: string };
      const network =
        ax.code === 'ECONNABORTED' ||
        ax.message === 'Network Error' ||
        (typeof ax.message === 'string' && ax.message.includes('Network'));
      setError(network ? getApiNetworkErrorMessage() : ax.message ?? 'Could not send your inquiry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="book-page">
      <header className="book-page__header">
        <Link to="/login" className="book-page__brand">
          <BrandLogo size="md" />
        </Link>
        <p className="book-page__venue">
          {BRAND.venueName} · {BRAND.venueLocation}
        </p>
      </header>

      <main className="book-page__main">
        {result ? (
          <div className="book-page__success" role="status">
            <p className="book-page__eyebrow">HuB on Lewis</p>
            <h1>We&apos;ve got you</h1>
            <p className="book-page__lede">
              Your inquiry is in. Hannah has it, and your event portal is ready. Email is still being wired up —
              copy or open this link so you can come back anytime.
            </p>
            <label className="form-label" htmlFor="portal-url">
              Your event portal
            </label>
            <input
              id="portal-url"
              className="form-input"
              readOnly
              value={result.portalUrl}
              onFocus={e => e.currentTarget.select()}
            />
            <div className="book-page__actions">
              <button type="button" className="btn btn-primary" onClick={() => void copyPortal(result.portalUrl)}>
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <a className="btn btn-secondary" href={result.portalUrl} target="_blank" rel="noreferrer">
                Open portal
              </a>
            </div>
          </div>
        ) : (
          <>
            <p className="book-page__eyebrow">Request a date</p>
            <h1>Book your event</h1>
            <p className="book-page__lede">
              Tell us the date, the room, and who to take care of. We&apos;ll check the calendar and set up your
              portal — no back-and-forth required.
            </p>
            <form className="book-page__form" onSubmit={e => void handleSubmit(e)}>
              <div className="book-page__grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="book-date">
                    Date
                  </label>
                  <input
                    id="book-date"
                    type="date"
                    className="form-input"
                    min={minDate}
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="book-space">
                    Space
                  </label>
                  <select
                    id="book-space"
                    className="form-input"
                    value={space}
                    onChange={e => setSpace(e.target.value)}
                    required
                  >
                    {BOOKING_SPACES.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="book-type">
                    Event type
                  </label>
                  <select
                    id="book-type"
                    className="form-input"
                    value={eventType}
                    onChange={e => setEventType(e.target.value)}
                    required
                  >
                    {VENUE_EVENT_TYPES.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="book-guests">
                    Guest count
                  </label>
                  <input
                    id="book-guests"
                    type="number"
                    className="form-input"
                    min={1}
                    max={5000}
                    value={guests}
                    onChange={e => setGuests(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="book-name">
                    Your name
                  </label>
                  <input
                    id="book-name"
                    type="text"
                    className="form-input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="book-email">
                    Email
                  </label>
                  <input
                    id="book-email"
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>
              {error ? (
                <div className="book-page__error" role="alert">
                  {error}
                </div>
              ) : null}
              <button type="submit" className="btn btn-primary book-page__submit" disabled={loading}>
                {loading ? 'Checking the calendar…' : 'Request this date'}
              </button>
            </form>
          </>
        )}
      </main>

      <footer className="book-page__footer">
        <LegalFooterLinks showContact />
        <Link to="/login" className="book-page__staff">
          Staff sign in
        </Link>
      </footer>
    </div>
  );
}