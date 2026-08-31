export type BookInquiryFields = {
  name: string;
  email: string;
  eventDate: string;
  space: string;
  eventType: string;
  guests: string;
  phone?: string;
  startTime?: string;
  notes?: string;
};

export type BookFieldErrors = Partial<
  Record<'name' | 'email' | 'eventDate' | 'space' | 'eventType' | 'guests' | 'phone' | 'form', string>
>;

export const ROOM_TAKEN_MESSAGE = 'That room is taken that day';

/** Optional phone: empty is fine; if present, 10 US digits or 11 with leading 1. */
export function isUsFriendlyPhone(raw: string | undefined): boolean {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return true;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return true;
  if (digits.length === 11 && digits.startsWith('1')) return true;
  return false;
}

export function validateBookInquiry(fields: BookInquiryFields): BookFieldErrors {
  const next: BookFieldErrors = {};
  if (!fields.name.trim()) next.name = 'Please enter your name.';
  if (!fields.email.trim()) next.email = 'Please enter your email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) next.email = 'Please enter a valid email.';
  if (!fields.eventDate) next.eventDate = 'Please pick a date.';
  if (!fields.space) next.space = 'Please pick a room.';
  if (!fields.eventType) next.eventType = 'Please pick an event type.';
  const guestCount = Number(fields.guests);
  if (!fields.guests.trim()) next.guests = 'Please enter a guest count.';
  else if (!Number.isFinite(guestCount) || guestCount < 1) next.guests = 'Please enter a guest count.';
  if (!isUsFriendlyPhone(fields.phone)) next.phone = 'Please enter a valid phone number.';
  return next;
}

export function bookInquiryPayload(fields: BookInquiryFields) {
  return {
    name: fields.name.trim(),
    email: fields.email.trim(),
    eventDate: fields.eventDate,
    space: fields.space,
    eventType: fields.eventType,
    guests: Number(fields.guests),
    phone: fields.phone?.trim() || undefined,
    startTime: fields.startTime || undefined,
    notes: fields.notes?.trim() || undefined,
  };
}

export function bookAvailabilityPayload(fields: Pick<BookInquiryFields, 'eventDate' | 'space'>) {
  return { eventDate: fields.eventDate, space: fields.space };
}

export function isRoomTakenResponse(
  status: number,
  body: { error?: string; available?: boolean } | null | undefined,
): boolean {
  if (status === 409) return true;
  if (body?.available === false) return true;
  if (body?.error && /taken|double-book|already booked|overlaps/i.test(body.error)) return true;
  return false;
}
