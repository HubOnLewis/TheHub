import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/index.js';
import { useLeadMutations } from '../../hooks/useLeads.js';
import { useAppStore } from '../../store/index.js';
import { leadDetailPath } from '../../config/paths.js';

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

const SOURCES = ['Website', 'Phone', 'Walk-in', 'Referral', 'Email', 'Social', 'Other'] as const;

export default function AddLeadModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const user = useAppStore(s => s.user);
  const { create } = useLeadMutations();

  const [contact, setContact] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState<string>('Website');
  const [eventType, setEventType] = useState<string>('Private party');
  const [eventDate, setEventDate] = useState('');
  const [guests, setGuests] = useState('50');
  const [space, setSpace] = useState<string>('Main Hall');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setContact('');
    setCompany('');
    setEmail('');
    setPhone('');
    setSource('Website');
    setEventType('Private party');
    setEventDate('');
    setGuests('50');
    setSpace('Main Hall');
    setEstimatedValue('');
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
    if (!contact.trim() || !company.trim()) {
      setError('Contact name and account / company are required.');
      return;
    }
    try {
      const guestCount = guests.trim() === '' ? undefined : Number(guests);
      const value = estimatedValue.trim() === '' ? undefined : Number(estimatedValue);
      const created = (await create.mutateAsync({
        contact: contact.trim(),
        company: company.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        source,
        notes: notes.trim() || undefined,
        assignedTo: user?.name || undefined,
        status: 'New',
        eventDate: eventDate || undefined,
        guestCount: Number.isFinite(guestCount) ? guestCount : undefined,
        eventType: eventType || undefined,
        spacePreference: space || undefined,
        estimatedValue: Number.isFinite(value) ? value : undefined,
      })) as { _id?: string };
      const id = created?._id;
      handleClose();
      if (id) navigate(leadDetailPath(String(id)));
    } catch (err) {
      const ax = err as { response?: { data?: { error?: string } }; message?: string };
      setError(ax.response?.data?.error ?? ax.message ?? 'Could not create lead');
    }
  };

  return (
    <Modal
      title="New lead inquiry"
      onClose={handleClose}
      width={640}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button type="submit" form="add-lead-form" className="btn btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Saving…' : 'Create lead'}
          </button>
        </>
      }
    >
      <form id="add-lead-form" onSubmit={e => void handleSubmit(e)}>
        {error ? (
          <div className="event-detail-error" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </div>
        ) : null}
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '1fr 1fr' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Contact name</span>
            <input className="form-input" value={contact} onChange={e => setContact(e.target.value)} required />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Account / company</span>
            <input className="form-input" value={company} onChange={e => setCompany(e.target.value)} required />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Email</span>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Phone</span>
            <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Source</span>
            <select className="form-input" value={source} onChange={e => setSource(e.target.value)}>
              {SOURCES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Event type</span>
            <select className="form-input" value={eventType} onChange={e => setEventType(e.target.value)}>
              {EVENT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Desired date</span>
            <input className="form-input" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Guest count</span>
            <input className="form-input" type="number" min={0} value={guests} onChange={e => setGuests(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Space preference</span>
            <select className="form-input" value={space} onChange={e => setSpace(e.target.value)}>
              {SPACES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Estimated value</span>
            <input className="form-input" type="number" min={0} value={estimatedValue} onChange={e => setEstimatedValue(e.target.value)} />
          </label>
          <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
            <span>Notes</span>
            <textarea className="form-textarea" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </label>
        </div>
      </form>
    </Modal>
  );
}
