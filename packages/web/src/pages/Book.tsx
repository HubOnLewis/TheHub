import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { VENUE_EVENT_TYPES, VENUE_SPACES } from '@hub-crm/shared';
import BrandLogo from '../components/BrandLogo.js';
import LegalFooterLinks from '../components/LegalFooterLinks.js';
import { BRAND } from '../branding/tokens.js';
import { resolveApiBaseUrl, getApiNetworkErrorMessage } from '../config/apiBaseUrl.js';
import { getApiConfigError } from '../api/client.js';
import {
  bookAvailabilityPayload,
  bookInquiryPayload,
  isRoomTakenResponse,
  ROOM_TAKEN_MESSAGE,
  validateBookInquiry,
  type BookFieldErrors,
} from '../lib/bookInquiry.js';

const BOOKING_SPACES = VENUE_SPACES.filter(s => s !== 'TBD');
const BOOK_TITLE = 'Book your event · HuB on Lewis';

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

function publicAvailabilityUrl(): { url: string; configError: string | null } {
  const { url, configError } = publicInquiryUrl();
  if (configError || !url) return { url: '', configError };
  return { url: `${url.replace(/\/$/, '')}/availability`, configError: null };
}

function guestConflictMessage(status: number, apiError: string | undefined): string | null {
  if (isRoomTakenResponse(status, { error: apiError })) {
    return ROOM_TAKEN_MESSAGE;
  }
  return null;
}

export default function BookPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [space, setSpace] = useState('');
  const [eventType, setEventType] = useState('');
  const [guests, setGuests] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<BookFieldErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InquiryOk | null>(null);
  const [copied, setCopied] = useState(false);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.title = BOOK_TITLE;
  }, []);

  const minDate = useMemo(() => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }, []);

  useEffect(() => {
    if (!result?.portalUrl) return;
    const t = window.setTimeout(() => {
      window.location.assign(result.portalUrl);
    }, 1600);
    return () => window.clearTimeout(t);
  }, [result]);

  useEffect(() => {
    if (!eventDate || !space) {
      setFieldErrors(prev => {
        if (prev.space !== ROOM_TAKEN_MESSAGE) return prev;
        const next = { ...prev };
        delete next.space;
        return next;
      });
      setError(prev => (prev === ROOM_TAKEN_MESSAGE ? '' : prev));
      return;
    }
    const { url, configError } = publicAvailabilityUrl();
    if (configError || !url) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookAvailabilityPayload({ eventDate, space, startTime })),
          });
          let body: { error?: string; available?: boolean } = {};
          try {
            body = (await res.json()) as { error?: string; available?: boolean };
          } catch {
            body = {};
          }
          if (cancelled) return;
          if (isRoomTakenResponse(res.status, body)) {
            setFieldErrors(prev => ({ ...prev, space: ROOM_TAKEN_MESSAGE }));
            setError(ROOM_TAKEN_MESSAGE);
          } else {
            setFieldErrors(prev => {
              if (prev.space !== ROOM_TAKEN_MESSAGE) return prev;
              const next = { ...prev };
              delete next.space;
              return next;
            });
            setError(prev => (prev === ROOM_TAKEN_MESSAGE ? '' : prev));
          }
        } catch {
          /* live check is best-effort; submit still checks before create */
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [eventDate, space, startTime]);

  const copyPortal = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const checkAvailabilityBeforeCreate = async (): Promise<boolean> => {
    const { url, configError } = publicAvailabilityUrl();
    if (configError || !url) return true;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookAvailabilityPayload({ eventDate, space, startTime })),
      });
      let body: { error?: string; available?: boolean } = {};
      try {
        body = (await res.json()) as { error?: string; available?: boolean };
      } catch {
        body = {};
      }
      if (isRoomTakenResponse(res.status, body)) {
        setFieldErrors(prev => ({ ...prev, space: ROOM_TAKEN_MESSAGE }));
        setError(ROOM_TAKEN_MESSAGE);
        return false;
      }
      return true;
    } catch {
      return true;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCopied(false);
    const nextErrors = validateBookInquiry({ name, email, eventDate, space, eventType, guests, phone, startTime, notes });
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const configErr = getApiConfigError();
    if (configErr) {
      setError(configErr);
      return;
    }
    const { url, configError } = publicInquiryUrl();
    if (configError || !url) {
      setError(configError ?? 'Cannot reach The Hub API.');
      return;
    }
    setLoading(true);
    try {
      const available = await checkAvailabilityBeforeCreate();
      if (!available) return;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          bookInquiryPayload({ name, email, eventDate, space, eventType, guests, phone, startTime, notes }),
        ),
      });
      let body: { error?: string } & Partial<InquiryOk> = {};
      try {
        body = (await res.json()) as { error?: string } & Partial<InquiryOk>;
      } catch {
        body = {};
      }
      if (res.status === 409 || guestConflictMessage(res.status, body.error)) {
        setFieldErrors(prev => ({ ...prev, space: ROOM_TAKEN_MESSAGE }));
        setError(guestConflictMessage(res.status, body.error) ?? ROOM_TAKEN_MESSAGE);
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

  const fieldErr = (key: keyof BookFieldErrors) =>
    fieldErrors[key] ? (
      <p className="book-page__field-error" role="alert">
        {fieldErrors[key]}
      </p>
    ) : null;

  return (
    <div className="book-page">
      <header className="book-page__header">
        <a href="https://hubonlewis.com" className="book-page__brand">
          <BrandLogo size="md" />
        </a>
        <p className="book-page__venue">
          {BRAND.venueName} · {BRAND.venueLocation}
        </p>
      </header>

      <main className="book-page__main">
        {result ? (
          <div className="book-page__success" role="status">
            <p className="book-page__eyebrow">HuB on Lewis</p>
            <h1>You&apos;re in. Save this link. We&apos;ll send a proposal.</h1>
            <p className="book-page__lede">
              This is not a booking and nothing is paid. Opening your event portal so you can come back anytime.
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
              <a className="btn btn-secondary" href={result.portalUrl} rel="noreferrer">
                Open portal
              </a>
            </div>
          </div>
        ) : (
          <>
            <p className="book-page__eyebrow">Request a date</p>
            <h1>Book your event</h1>
            <p className="book-page__lede">
              Tell us the date, the room, and who to take care of. We&apos;ll check the calendar and send a proposal —
              you are not booked or charged yet.
            </p>
            <form className="book-page__form" noValidate onSubmit={e => void handleSubmit(e)}>
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
                    aria-invalid={Boolean(fieldErrors.eventDate)}
                    aria-required="true"
                  />
                  {fieldErr('eventDate')}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="book-space">
                    Which room?
                  </label>
                  <select
                    id="book-space"
                    className="form-input"
                    value={space}
                    onChange={e => setSpace(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.space)}
                    aria-required="true"
                  >
                    <option value="">Choose a room</option>
                    {BOOKING_SPACES.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {fieldErr('space')}
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
                    aria-invalid={Boolean(fieldErrors.eventType)}
                    aria-required="true"
                  >
                    <option value="">Choose event type</option>
                    {VENUE_EVENT_TYPES.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {fieldErr('eventType')}
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
                    placeholder="e.g. 80"
                    onChange={e => setGuests(e.target.value)}
                    aria-invalid={Boolean(fieldErrors.guests)}
                    aria-required="true"
                  />
                  {fieldErr('guests')}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="book-time">
                    Start time (optional)
                  </label>
                  <input
                    id="book-time"
                    type="time"
                    className="form-input"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="book-phone">
                    Phone (optional)
                  </label>
                  <input
                    id="book-phone"
                    type="tel"
                    className="form-input"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    autoComplete="tel"
                    placeholder="Optional"
                    aria-invalid={Boolean(fieldErrors.phone)}
                  />
                  {fieldErr('phone')}
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
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-required="true"
                  />
                  {fieldErr('name')}
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
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-required="true"
                  />
                  {fieldErr('email')}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="book-notes">
                  Tell us about your event
                </label>
                <textarea
                  id="book-notes"
                  className="form-input"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Anything we should know — vibe, timing, must-haves."
                />
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
