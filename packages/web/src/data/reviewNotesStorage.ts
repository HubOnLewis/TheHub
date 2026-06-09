/**
 * Client review suggested edits — persisted in localStorage (no backend).
 */

export type ReviewNoteStatus = 'New' | 'Reviewing' | 'Planned' | 'Done';
export type ReviewNotePriority = 'low' | 'medium' | 'high';

export interface ReviewNote {
  id: string;
  title: string;
  submittedBy: string;
  area: string;
  priority: ReviewNotePriority;
  status: ReviewNoteStatus;
  comment: string;
  createdAt: string;
}

const STORAGE_KEY = 'hub-crm-review-notes';

const SEED: ReviewNote[] = [
  {
    id: 'rn1',
    title: 'Adjust proposal follow-up wording',
    submittedBy: 'Hannah Bayless',
    area: 'Email templates · Proposal sent',
    priority: 'medium',
    status: 'New',
    comment: 'Tone should feel warmer for nonprofit boards — less “invoice chase,” more “partnership check-in.”',
    createdAt: '2026-05-19T14:22:00.000Z',
  },
  {
    id: 'rn2',
    title: 'Add preferred layout photo to venue profile',
    submittedBy: 'Jason Lavender',
    area: 'Settings · Venue profile',
    priority: 'high',
    status: 'Reviewing',
    comment: 'Use Grand Hall north-stage photo from April investor lunch for hero slot.',
    createdAt: '2026-05-18T09:10:00.000Z',
  },
  {
    id: 'rn3',
    title: 'Confirm tax and fee setup',
    submittedBy: 'Jason Lavender',
    area: 'Settings · Taxes & fees',
    priority: 'high',
    status: 'Planned',
    comment: 'Verify 7.5% KS sales tax + 2% service fee display on client-facing proposal preview.',
    createdAt: '2026-05-17T16:45:00.000Z',
  },
  {
    id: 'rn4',
    title: "Review Hannah's permissions",
    submittedBy: 'Jason Lavender',
    area: 'User management',
    priority: 'medium',
    status: 'Planned',
    comment: 'Hannah should edit proposals but not release calendar holds without ops lead.',
    createdAt: '2026-05-16T11:30:00.000Z',
  },
  {
    id: 'rn5',
    title: 'Update client-facing proposal preview copy',
    submittedBy: 'Hannah Bayless',
    area: 'Opportunities · Proposal preview',
    priority: 'low',
    status: 'Done',
    comment: 'Changed “balance due” label to “remaining balance” per Jason’s note — confirm on next deploy.',
    createdAt: '2026-05-14T08:05:00.000Z',
  },
];

function loadRaw(): ReviewNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReviewNote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(notes: ReviewNote[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function loadReviewNotes(): ReviewNote[] {
  const existing = loadRaw();
  if (existing.length === 0) {
    save(SEED);
    return [...SEED];
  }
  return existing;
}

export function addReviewNote(
  input: Omit<ReviewNote, 'id' | 'createdAt' | 'status'> & { status?: ReviewNoteStatus },
): ReviewNote {
  const notes = loadReviewNotes();
  const note: ReviewNote = {
    ...input,
    id: `rn-${Date.now()}`,
    status: input.status ?? 'New',
    createdAt: new Date().toISOString(),
  };
  save([note, ...notes]);
  return note;
}

export function updateReviewNoteStatus(id: string, status: ReviewNoteStatus): ReviewNote[] {
  const notes = loadReviewNotes().map(n => (n.id === id ? { ...n, status } : n));
  save(notes);
  return notes;
}

export function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
