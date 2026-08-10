import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/index.js';
import { useDealMutations } from '../../hooks/useDeals.js';
import { useAppStore } from '../../store/index.js';
import { opportunityDetailPath } from '../../config/paths.js';

type Props = {
  open: boolean;
  onClose: () => void;
};

const EVENT_TYPES = [
  'Wedding',
  'Corporate',
  'Birthday',
  'Graduation',
  'Baby shower',
  'Fundraiser',
  'Private party',
  'Other',
] as const;

const SPACES = ['Main Hall', 'Gallery', 'Patio', 'Full venue', 'TBD'] as const;

export default function AddEventModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const user = useAppStore(s => s.user);
  const { create } = useDealMutations();

  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [eventType, setEventType] = useState<string>('Private party');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('22:00');
  const [guests, setGuests] = useState('50');
  const [space, setSpace] = useState<string>('Main Hall');
  const [amount, setAmount] = useState('2500');
  const [deposit, setDeposit] = useState('0');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setTitle('');
    setCompany('');
    setContact('');
    setEmail('');
    setPhone('');
    setEventType('Private party');
    setEventDate('');
    setStartTime('17:00');
    setEndTime('22:00');
    setGuests('50');
    setSpace('Main Hall');
    setAmount('2500');
    setDeposit('0');
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const eventTitle = title.trim();
    const account = company.trim() || contact.trim() || 'Walk-in client';
    const who = contact.trim() || account;
    if (!eventTitle) {
      setError('Event name is required.');
      return;
    }
    if (!who) {
      setError('Contact name is required.');
      return;
    }

    const grandTotal = Math.max(0, Number(amount) || 0);
    const amountPaid = Math.max(0, Number(deposit) || 0);
    const guestCount = Math.max(0, Math.floor(Number(guests) || 0));

    try {
      const created = (await create.mutateAsync({
        title: eventTitle,
        company: account,
        contact: who,
        amount: grandTotal,
        assignedTo: user?.name || 'Jason Lavender',
        notes: notes.trim() || undefined,
        status: 'Draft',
        importMeta: {
          source: 'hub_manual_booking',
          eventType,
          eventDate: eventDate || undefined,
          eventDateIso: eventDate || undefined,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          guests: guestCount || undefined,
          space,
          contactEmail: email.trim() || undefined,
          contactPhone: phone.trim() || undefined,
          grandTotal,
          amountPaid,
          balanceDue: Math.max(0, grandTotal - amountPaid),
          pvStatus: amountPaid > 0 ? 'qualified' : 'lead',
          leadSource: 'Walk-in / phone',
        },
      })) as { _id?: string };

      const newId = created?._id;
      handleClose();
      if (newId) {
        navigate(opportunityDetailPath(String(newId)));
      }
    } catch (err) {
      const ax = err as { response?: { data?: { error?: string } }; message?: string };
      setError(ax.response?.data?.error ?? ax.message ?? 'Could not create event');
    }
  };

  return (
    <Modal title="New venue booking" onClose={handleClose} width={640}>
      <form onSubmit={e => void handleSubmit(e)}>
        <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
          Create a live booking for HuB on Lewis — client, date, space, and money on one record.
        </p>

        {error ? (
          <div className="event-detail-error" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </div>
        ) : null}

        <div className="form-grid">
          <div className="form-group full">
            <label className="form-label">Event name *</label>
            <input
              className="form-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Rivera Anniversary Dinner"
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Contact *</label>
            <input
              className="form-input"
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder="Primary client name"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Account / organization</label>
            <input
              className="form-input"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Company or family name"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="client@email.com"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input
              className="form-input"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(316) 555-0100"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Event type</label>
            <select className="form-input" value={eventType} onChange={e => setEventType(e.target.value)}>
              {EVENT_TYPES.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Space</label>
            <select className="form-input" value={space} onChange={e => setSpace(e.target.value)}>
              {SPACES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Event date</label>
            <input
              className="form-input"
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Guests</label>
            <input
              className="form-input"
              type="number"
              min={0}
              value={guests}
              onChange={e => setGuests(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Start</label>
            <input
              className="form-input"
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">End</label>
            <input
              className="form-input"
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Grand total ($)</label>
            <input
              className="form-input"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Deposit paid ($)</label>
            <input
              className="form-input"
              type="number"
              min={0}
              step="0.01"
              value={deposit}
              onChange={e => setDeposit(e.target.value)}
            />
          </div>
          <div className="form-group full">
            <label className="form-label">Internal notes</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="How they found us, preferences, allergies…"
            />
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '16px 0 0', borderTop: 'none', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create booking'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
