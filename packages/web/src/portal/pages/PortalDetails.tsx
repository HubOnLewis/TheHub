import { useEffect, useState } from 'react';
import {
  BAR_PACKAGES,
  BAR_PACKAGE_LABELS,
  EVENT_CONTACT_ROLES,
  EVENT_CONTACT_ROLE_LABELS,
  LAYOUT_OPTIONS,
  type BarPackage,
  type ClientDetails,
  type ClientTimelineBlock,
  type ClientVendor,
  type EventContact,
  type EventContactRole,
} from '@hub-crm/shared';
import { usePortalStore } from '../portalStore.js';

function blankBlock(): ClientTimelineBlock {
  return { id: `block-${Date.now()}`, label: '', startTime: '', endTime: '' };
}

function blankVendor(): ClientVendor {
  return { id: `vendor-${Date.now()}`, type: '', name: '', status: 'placeholder' };
}

function blankContact(): EventContact {
  return { name: '', role: 'planner' };
}

export default function PortalDetails() {
  const snapshot = usePortalStore(s => s.snapshot);
  const event = usePortalStore(s => s.event);
  const saveDetails = usePortalStore(s => s.saveClientDetails);
  const profile = usePortalStore(s => s.profile);

  const seeded: ClientDetails = snapshot?.clientDetails ?? {
    guestCount: event.guestCount,
    layout: event.layoutChoice || undefined,
  };

  const [guestCount, setGuestCount] = useState(seeded.guestCount ?? event.guestCount ?? 0);
  const [layout, setLayout] = useState(seeded.layout ?? event.layoutChoice ?? '');
  const [barPackage, setBarPackage] = useState<string>(seeded.barPackage ?? 'none');
  const [allergies, setAllergies] = useState(seeded.allergies ?? '');
  const [musicCutoff, setMusicCutoff] = useState(seeded.musicCutoff ?? '');
  const [blocks, setBlocks] = useState<ClientTimelineBlock[]>(
    seeded.timelineBlocks?.length ? seeded.timelineBlocks : [blankBlock()],
  );
  const [vendors, setVendors] = useState<ClientVendor[]>(
    seeded.vendors?.length ? seeded.vendors : [blankVendor()],
  );
  const [contacts, setContacts] = useState<EventContact[]>(
    seeded.contacts?.length
      ? seeded.contacts
      : [{ name: profile.contactName, role: 'client' }, blankContact()],
  );
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = snapshot?.clientDetails;
    if (!d) return;
    if (d.guestCount != null) setGuestCount(d.guestCount);
    if (d.layout) setLayout(d.layout);
    if (d.barPackage) setBarPackage(d.barPackage);
    if (d.allergies != null) setAllergies(d.allergies);
    if (d.musicCutoff != null) setMusicCutoff(d.musicCutoff);
    if (d.timelineBlocks?.length) setBlocks(d.timelineBlocks);
    if (d.vendors?.length) setVendors(d.vendors);
    if (d.contacts?.length) setContacts(d.contacts);
  }, [snapshot?.clientDetails]);

  const onSave = async () => {
    setSaving(true);
    setStatus(null);
    const payload: ClientDetails = {
      guestCount: Math.max(0, Number(guestCount) || 0),
      layout: layout.trim() || undefined,
      barPackage: barPackage || undefined,
      allergies: allergies.trim() || undefined,
      musicCutoff: musicCutoff.trim() || undefined,
      timelineBlocks: blocks.filter(b => b.label.trim()),
      vendors: vendors.filter(v => v.name.trim() || v.type.trim()),
      contacts: contacts.filter(c => c.name.trim()),
    };
    const result = await saveDetails(payload);
    setSaving(false);
    setStatus(result.message);
  };

  return (
    <>
      <h1 style={{ fontFamily: 'var(--portal-display)', fontSize: 28, margin: '0 0 8px' }}>Event details</h1>
      <p style={{ color: 'var(--portal-muted)', margin: '0 0 20px' }}>
        These fields are the same ones your coordinator uses on the banquet event order.
      </p>

      <div className="portal-card portal-card--flat" style={{ marginBottom: 16 }}>
        <h3>Guest count</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" className="portal-btn portal-btn--secondary" onClick={() => setGuestCount(Math.max(0, guestCount - 1))}>
            −
          </button>
          <input
            type="number"
            min={0}
            value={guestCount}
            onChange={e => setGuestCount(Math.max(0, Number(e.target.value) || 0))}
            style={{ width: 80, textAlign: 'center', fontSize: 22, fontWeight: 700 }}
          />
          <button type="button" className="portal-btn portal-btn--secondary" onClick={() => setGuestCount(guestCount + 1)}>
            +
          </button>
        </div>
      </div>

      <div className="portal-card portal-card--flat" style={{ marginBottom: 16 }}>
        <h3>Layout</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {LAYOUT_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              className={`portal-btn ${layout === opt ? 'portal-btn--primary' : 'portal-btn--secondary'}`}
              onClick={() => setLayout(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="portal-card portal-card--flat" style={{ marginBottom: 16 }}>
        <h3>Bar package</h3>
        <select
          className="form-select"
          value={barPackage}
          onChange={e => setBarPackage(e.target.value as BarPackage)}
        >
          {BAR_PACKAGES.map(p => (
            <option key={p} value={p}>
              {BAR_PACKAGE_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="portal-card portal-card--flat" style={{ marginBottom: 16 }}>
        <h3>Timeline blocks</h3>
        {blocks.map((b, i) => (
          <div key={b.id} style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            <input
              className="form-input"
              placeholder="e.g. Cocktail hour"
              value={b.label}
              onChange={e =>
                setBlocks(rows => rows.map((r, idx) => (idx === i ? { ...r, label: e.target.value } : r)))
              }
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                placeholder="Start (5:00 PM)"
                value={b.startTime}
                onChange={e =>
                  setBlocks(rows => rows.map((r, idx) => (idx === i ? { ...r, startTime: e.target.value } : r)))
                }
              />
              <input
                className="form-input"
                placeholder="End (6:00 PM)"
                value={b.endTime}
                onChange={e =>
                  setBlocks(rows => rows.map((r, idx) => (idx === i ? { ...r, endTime: e.target.value } : r)))
                }
              />
            </div>
          </div>
        ))}
        <button type="button" className="portal-btn portal-btn--secondary" onClick={() => setBlocks(rows => [...rows, blankBlock()])}>
          Add block
        </button>
      </div>

      <div className="portal-card portal-card--flat" style={{ marginBottom: 16 }}>
        <h3>Vendor roster</h3>
        {vendors.map((v, i) => (
          <div key={v.id} style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            <input
              className="form-input"
              placeholder="Type (DJ, florist, planner)"
              value={v.type}
              onChange={e =>
                setVendors(rows => rows.map((r, idx) => (idx === i ? { ...r, type: e.target.value } : r)))
              }
            />
            <input
              className="form-input"
              placeholder="Name"
              value={v.name}
              onChange={e =>
                setVendors(rows => rows.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))
              }
            />
          </div>
        ))}
        <button type="button" className="portal-btn portal-btn--secondary" onClick={() => setVendors(rows => [...rows, blankVendor()])}>
          Add vendor
        </button>
      </div>

      <div className="portal-card portal-card--flat" style={{ marginBottom: 16 }}>
        <h3>Allergies & music cutoff</h3>
        <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Food allergies / restrictions</label>
        <textarea
          className="form-textarea"
          rows={3}
          value={allergies}
          onChange={e => setAllergies(e.target.value)}
          placeholder="List any allergies the kitchen should know"
        />
        <label style={{ display: 'block', fontSize: 13, margin: '12px 0 6px' }}>Music cutoff</label>
        <input
          className="form-input"
          value={musicCutoff}
          onChange={e => setMusicCutoff(e.target.value)}
          placeholder="e.g. 10:00 PM"
        />
      </div>

      <div className="portal-card portal-card--flat" style={{ marginBottom: 16 }}>
        <h3>Contacts</h3>
        <p style={{ fontSize: 13, color: 'var(--portal-muted)' }}>
          Primary client stays on the booking. Add a planner or partner here.
        </p>
        {contacts.map((c, i) => (
          <div key={`${c.role}-${i}`} style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            <input
              className="form-input"
              placeholder="Name"
              value={c.name}
              onChange={e =>
                setContacts(rows => rows.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))
              }
            />
            <input
              className="form-input"
              placeholder="Email"
              value={c.email ?? ''}
              onChange={e =>
                setContacts(rows => rows.map((r, idx) => (idx === i ? { ...r, email: e.target.value } : r)))
              }
            />
            <select
              className="form-select"
              value={c.role}
              onChange={e =>
                setContacts(rows =>
                  rows.map((r, idx) => (idx === i ? { ...r, role: e.target.value as EventContactRole } : r)),
                )
              }
            >
              {EVENT_CONTACT_ROLES.map(role => (
                <option key={role} value={role}>
                  {EVENT_CONTACT_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
        ))}
        <button type="button" className="portal-btn portal-btn--secondary" onClick={() => setContacts(rows => [...rows, blankContact()])}>
          Add contact
        </button>
      </div>

      <button type="button" className="portal-btn portal-btn--primary" disabled={saving} onClick={() => void onSave()}>
        {saving ? 'Saving…' : 'Save details'}
      </button>
      {status ? <p role="status" style={{ marginTop: 12 }}>{status}</p> : null}
    </>
  );
}
