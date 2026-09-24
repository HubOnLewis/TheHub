import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  VENUE_EVENT_TYPES,
  VENUE_SPACES,
  dayHasOpenSlot,
  timesForPublicSlot,
  type PublicAvailabilityDay,
  type PublicOccupancySlot,
} from '@hub-crm/shared';
import BrandLogo from '../components/BrandLogo.js';
import HubSiteFooter from '../components/HubSiteFooter.js';
import { BRAND } from '../branding/tokens.js';
import { resolveApiBaseUrl, getApiNetworkErrorMessage } from '../config/apiBaseUrl.js';
import { getApiConfigError } from '../api/client.js';
import {
  AVAILABILITY_CHANGED_MESSAGE,
  bookInquiryPayload,
  isAvailabilityChangedResponse,
  validateBookInquiry,
  type BookFieldErrors,
  type BookInquiryFields,
} from '../lib/bookInquiry.js';
import {
  WEEKDAY_LETTERS,
  WEEKDAY_NAMES,
  buildMonthCells,
  dayAriaLabel,
  formatBookDate,
  formatClock,
  monthLabel,
  normalizePublicDay,
  preferredSlot,
  statusLabel,
} from '../lib/publicAvailabilityCalendar.js';

const BOOKING_SPACES = VENUE_SPACES.filter(s => s !== 'TBD');
const BOOK_TITLE = 'Request your date · HuB on Lewis';

type InquiryOk = {
  received?: boolean;
  confirmedBooking?: boolean;
  requestedDate?: string;
};

function publicInquiryUrl(): { url: string; configError: string | null } {
  const { baseUrl, configError } = resolveApiBaseUrl();
  if (configError || !baseUrl) return { url: '', configError: configError ?? 'API URL is not configured.' };
  return { url: `${baseUrl.replace(/\/$/, '')}/public/inquiry`, configError: null };
}

function publicDaysUrl(startDate: string, endDate: string): { url: string; configError: string | null } {
  const { baseUrl, configError } = resolveApiBaseUrl();
  if (configError || !baseUrl) return { url: '', configError: configError ?? 'API URL is not configured.' };
  const root = `${baseUrl.replace(/\/$/, '')}/public/availability`;
  return {
    url: `${root}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
    configError: null,
  };
}

function isoMonthBounds(year: number, monthIndex: number): { startDate: string; endDate: string } {
  const startDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const endDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { startDate, endDate };
}

export default function BookPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [days, setDays] = useState<Record<string, PublicAvailabilityDay>>({});
  const [requestedSlot, setRequestedSlot] = useState<PublicOccupancySlot | ''>('');
  const [calendarError, setCalendarError] = useState('');
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [availabilityChanged, setAvailabilityChanged] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('22:00');
  const [space, setSpace] = useState('Full venue');
  const [eventType, setEventType] = useState('');
  const [guests, setGuests] = useState('');
  const [notes, setNotes] = useState('');
  const [walkthroughRequested, setWalkthroughRequested] = useState(false);
  const [alternateDate, setAlternateDate] = useState('');
  const [packageInterest, setPackageInterest] = useState('');
  const [cateringBarNeeds, setCateringBarNeeds] = useState('');
  const [fieldErrors, setFieldErrors] = useState<BookFieldErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InquiryOk | null>(null);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.title = BOOK_TITLE;
  }, []);

  const bounds = useMemo(() => isoMonthBounds(year, monthIndex), [year, monthIndex]);
  const cells = useMemo(() => buildMonthCells(year, monthIndex), [year, monthIndex]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setCalendarLoading(true);
      setCalendarError('');
      const { url, configError } = publicDaysUrl(bounds.startDate, bounds.endDate);
      if (configError || !url) {
        if (!cancelled) {
          setCalendarError(configError ?? 'Cannot reach The Hub API.');
          setCalendarLoading(false);
        }
        return;
      }
      try {
        const res = await fetch(url);
        const text = await res.text();
        let body: { days?: Array<PublicAvailabilityDay>; error?: string } = {};
        try {
          body = text ? (JSON.parse(text) as typeof body) : {};
        } catch {
          throw new Error('Availability service is temporarily unavailable. Please try again shortly.');
        }
        if (!res.ok) throw new Error(body.error || 'Could not load availability.');
        const map: Record<string, PublicAvailabilityDay> = {};
        for (const day of body.days ?? []) map[day.date] = normalizePublicDay(day);
        if (!cancelled) setDays(map);
      } catch (err) {
        if (!cancelled) setCalendarError(err instanceof Error ? err.message : 'Could not load availability.');
      } finally {
        if (!cancelled) setCalendarLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [bounds.endDate, bounds.startDate]);

  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(year, monthIndex + delta, 1));
    setYear(next.getUTCFullYear());
    setMonthIndex(next.getUTCMonth());
  };

  const emptyDay = (date: string): PublicAvailabilityDay => ({
    date,
    status: 'available',
    morning: 'available',
    evening: 'available',
  });

  const applySlot = (slot: PublicOccupancySlot) => {
    setRequestedSlot(slot);
    const times = timesForPublicSlot(slot);
    setStartTime(times.startTime);
    setEndTime(times.endTime);
  };

  const pickDate = (date: string) => {
    setSelectedDate(date);
    setAvailabilityChanged(false);
    setError('');
    const slot = preferredSlot(days[date] ?? emptyDay(date));
    if (slot) applySlot(slot);
    else setRequestedSlot('');
  };

  const fields = (): BookInquiryFields => ({
    name,
    email,
    eventDate: selectedDate,
    space,
    eventType,
    guests,
    phone,
    startTime,
    endTime,
    notes,
    walkthroughRequested,
    alternateDate,
    requestedSpaces: space,
    packageInterest,
    cateringBarNeeds,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAvailabilityChanged(false);
    const nextErrors = validateBookInquiry(fields());
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
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookInquiryPayload(fields())),
      });
      let body: { error?: string; code?: string } & Partial<InquiryOk> = {};
      try {
        body = (await res.json()) as { error?: string; code?: string } & Partial<InquiryOk>;
      } catch {
        body = {};
      }
      if (isAvailabilityChangedResponse(res.status, body) || res.status === 409) {
        setAvailabilityChanged(true);
        setError(AVAILABILITY_CHANGED_MESSAGE);
        setSelectedDate('');
        const { url: refreshUrl } = publicDaysUrl(bounds.startDate, bounds.endDate);
        if (refreshUrl) {
          const refresh = await fetch(refreshUrl);
          const refreshed = (await refresh.json()) as { days?: Array<PublicAvailabilityDay> };
          const map: Record<string, PublicAvailabilityDay> = {};
          for (const day of refreshed.days ?? []) map[day.date] = normalizePublicDay(day);
          setDays(map);
        }
        return;
      }
      if (!res.ok) {
        setError(body.error || (res.status === 429 ? 'Too many inquiries — try again later.' : 'Something went wrong. Please try again.'));
        return;
      }
      setResult({
        received: true,
        confirmedBooking: false,
        requestedDate: body.requestedDate || selectedDate,
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

  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="book-page book-page--availability">
      <header className="book-page__header">
        <a href="https://hubonlewis.com" className="book-page__brand">
          <BrandLogo size="md" />
        </a>
        <p className="book-page__venue">
          {BRAND.venueName} · {BRAND.venueLocation}
        </p>
      </header>

      <main className="book-page__main book-page__main--wide">
        {result ? (
          <div className="book-page__success" role="status">
            <p className="book-page__eyebrow">Request received</p>
            <h1>Your date request has been received.</h1>
            <p className="book-page__lede">
              {result.requestedDate ? `We have placed a 7-day hold on ${result.requestedDate}.` : 'We have placed a 7-day hold on that date.'}{' '}
              This is not a confirmed booking and nothing is charged. Our team will review your event details and follow up.
            </p>
          </div>
        ) : (
          <>
            <p className="book-page__eyebrow">Check availability</p>
            <h1>Request your date</h1>
            <p className="book-page__lede">
              Green days are open. Split days have a morning or evening still free. Submitting a request does not
              book the venue.
            </p>

            <section className="avail-cal" aria-label="Venue availability calendar">
              <div className="avail-cal__toolbar">
                <button type="button" className="btn btn-secondary avail-cal__nav" onClick={() => shiftMonth(-1)}>
                  Previous
                </button>
                <h2>{monthLabel(year, monthIndex)}</h2>
                <button type="button" className="btn btn-secondary avail-cal__nav" onClick={() => shiftMonth(1)}>
                  Next
                </button>
              </div>
              {calendarLoading ? <p className="avail-cal__status">Loading this month…</p> : null}
              {calendarError ? (
                <p className="book-page__error" role="alert">
                  {calendarError}
                </p>
              ) : null}
              <div className="avail-cal__weekdays">
                {WEEKDAY_LETTERS.map((day, idx) => (
                  <span key={`${day}-${idx}`} title={WEEKDAY_NAMES[idx]}>
                    {day}
                  </span>
                ))}
              </div>
              <div className="avail-cal__grid">
                {cells.map((cell, idx) => {
                  if (!cell.date || !cell.inMonth) {
                    return <span key={`e-${idx}`} className="avail-cal__cell avail-cal__cell--empty" />;
                  }
                  const day = days[cell.date] ?? emptyDay(cell.date);
                  const past = cell.date < todayIso;
                  const selectable = dayHasOpenSlot(day) && !past;
                  const selected = selectedDate === cell.date;
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      className={`avail-cal__cell avail-cal__cell--${day.status}${selected ? ' is-selected' : ''}${past ? ' is-past' : ''}`}
                      disabled={!selectable}
                      onClick={() => pickDate(cell.date!)}
                      aria-label={dayAriaLabel(cell.date, day, past, selectable)}
                      aria-pressed={selected}
                    >
                      <span className="avail-cal__num">{Number(cell.date.slice(8))}</span>
                      <span className="avail-cal__slots" aria-hidden="true">
                        <span className={`avail-cal__pip avail-cal__pip--${past ? 'past' : day.morning}`} title={`Morning ${statusLabel(day.morning)}`} />
                        <span className={`avail-cal__pip avail-cal__pip--${past ? 'past' : day.evening}`} title={`Evening ${statusLabel(day.evening)}`} />
                      </span>
                    </button>
                  );
                })}
              </div>
              <ul className="avail-cal__legend">
                <li>
                  <span className="avail-cal__swatch avail-cal__cell--available" /> Open all day
                </li>
                <li>
                  <span className="avail-cal__swatch avail-cal__cell--partial" /> Morning or evening still open
                </li>
                <li>
                  <span className="avail-cal__swatch avail-cal__cell--hold" /> Hold
                </li>
                <li>
                  <span className="avail-cal__swatch avail-cal__cell--booked" /> Booked all day
                </li>
                <li>
                  <span className="avail-cal__swatch avail-cal__cell--closed" /> Closed
                </li>
              </ul>
              <p className="avail-cal__caption">
                Each square has two marks: morning (left) and evening (right). Split at 3:00 PM.
              </p>
            </section>

            {selectedDate ? (
              <form className="book-page__form avail-form" noValidate onSubmit={e => void handleSubmit(e)}>
                <h2>Tell us about your gathering</h2>
                <p className="book-page__lede">
                  {formatBookDate(selectedDate)}
                  {requestedSlot === 'morning'
                    ? ' · morning'
                    : requestedSlot === 'evening'
                      ? ' · evening'
                      : requestedSlot === 'allDay'
                        ? ' · full day'
                        : ''}
                  . We re-check the calendar when you submit. This is a request, not a booking.
                </p>
                {(() => {
                  const selected = days[selectedDate] ?? emptyDay(selectedDate);
                  const morningOpen = selected.morning === 'available';
                  const eveningOpen = selected.evening === 'available';
                  const bothOpen = morningOpen && eveningOpen;
                  return (
                    <fieldset className="avail-slots">
                      <legend>When do you want the space?</legend>
                      <div className="avail-slots__grid">
                        <button
                          type="button"
                          className={`avail-slots__btn${requestedSlot === 'morning' ? ' is-selected' : ''}`}
                          disabled={!morningOpen}
                          onClick={() => applySlot('morning')}
                        >
                          <strong>Morning</strong>
                          <span>9 AM – 2 PM</span>
                          <em>{morningOpen ? 'Open' : 'Unavailable'}</em>
                        </button>
                        <button
                          type="button"
                          className={`avail-slots__btn${requestedSlot === 'evening' ? ' is-selected' : ''}`}
                          disabled={!eveningOpen}
                          onClick={() => applySlot('evening')}
                        >
                          <strong>Evening</strong>
                          <span>5 PM – 10 PM</span>
                          <em>{eveningOpen ? 'Open' : 'Unavailable'}</em>
                        </button>
                        {bothOpen ? (
                          <button
                            type="button"
                            className={`avail-slots__btn avail-slots__btn--wide${requestedSlot === 'allDay' ? ' is-selected' : ''}`}
                            onClick={() => applySlot('allDay')}
                          >
                            <strong>Full day</strong>
                            <span>9 AM – 10 PM</span>
                            <em>Both windows</em>
                          </button>
                        ) : null}
                      </div>
                      <p className="avail-cal__caption">
                        Requested hours: {formatClock(startTime)} – {formatClock(endTime)}. Need a different window?
                        Add it in additional details.
                      </p>
                    </fieldset>
                  );
                })()}
                <div className="book-page__grid">
                  <div className="form-group">
                    <label className="form-label" htmlFor="book-type">
                      Event type
                    </label>
                    <select
                      id="book-type"
                      className="form-input"
                      value={eventType}
                      onChange={e => setEventType(e.target.value)}
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
                      max={99}
                      value={guests}
                      onChange={e => setGuests(e.target.value)}
                    />
                    {fieldErr('guests')}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="book-space">
                      Requested space
                    </label>
                    <select id="book-space" className="form-input" value={space} onChange={e => setSpace(e.target.value)}>
                      {BOOKING_SPACES.map(s => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {fieldErr('space')}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="book-alt">
                      Alternate date (optional)
                    </label>
                    <input
                      id="book-alt"
                      type="date"
                      className="form-input"
                      value={alternateDate}
                      onChange={e => setAlternateDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="book-name">
                      Your name
                    </label>
                    <input id="book-name" className="form-input" value={name} onChange={e => setName(e.target.value)} />
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
                    />
                    {fieldErr('email')}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="book-phone">
                      Phone
                    </label>
                    <input id="book-phone" type="tel" className="form-input" value={phone} onChange={e => setPhone(e.target.value)} />
                    {fieldErr('phone')}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="book-package">
                      Package interest (optional)
                    </label>
                    <input
                      id="book-package"
                      className="form-input"
                      value={packageInterest}
                      onChange={e => setPackageInterest(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="book-catering">
                    Catering / bar needs (optional)
                  </label>
                  <input
                    id="book-catering"
                    className="form-input"
                    value={cateringBarNeeds}
                    onChange={e => setCateringBarNeeds(e.target.value)}
                  />
                </div>
                <label className="avail-form__check">
                  <input
                    type="checkbox"
                    checked={walkthroughRequested}
                    onChange={e => setWalkthroughRequested(e.target.checked)}
                  />
                  I would like a walkthrough
                </label>
                <div className="form-group">
                  <label className="form-label" htmlFor="book-notes">
                    Additional details
                  </label>
                  <textarea
                    id="book-notes"
                    className="form-input"
                    rows={3}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
                {error ? (
                  <div className="book-page__error" role="alert">
                    {error}
                    {availabilityChanged ? ' Choose another available date above — your details are still here.' : null}
                  </div>
                ) : null}
                <button type="submit" className="btn btn-primary book-page__submit" disabled={loading}>
                  {loading ? 'Sending request…' : 'Submit date request'}
                </button>
              </form>
            ) : (
              <p className="avail-cal__hint">Select an available date to continue.</p>
            )}
          </>
        )}
      </main>

      <HubSiteFooter
        extra={
          <Link to="/login" className="book-page__staff">
            Staff sign in
          </Link>
        }
      />
    </div>
  );
}
