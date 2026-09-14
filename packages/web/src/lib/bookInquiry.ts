export type BookInquiryFields = {
  name: string;
  email: string;
  eventDate: string;
  space: string;
  eventType: string;
  guests: string;
  phone?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  walkthroughRequested?: boolean;
  alternateDate?: string;
  requestedSpaces?: string;
  packageInterest?: string;
  cateringBarNeeds?: string;
};

export type BookFieldErrors = Partial<
  Record<
    | 'name'
    | 'email'
    | 'eventDate'
    | 'space'
    | 'eventType'
    | 'guests'
    | 'phone'
    | 'startTime'
    | 'endTime'
    | 'form',
    string
  >
>;

export const ROOM_TAKEN_MESSAGE = 'That room is taken that day';
export const AVAILABILITY_CHANGED_CODE = 'AVAILABILITY_CHANGED';
export const AVAILABILITY_CHANGED_MESSAGE =
  'That date changed while you were completing your request. Your event details have been preserved so you can choose another date.';

export function isUsFriendlyPhone(raw: string | undefined): boolean {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return false;
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
  if (!fields.startTime?.trim()) next.startTime = 'Please choose a start time.';
  if (!fields.endTime?.trim()) next.endTime = 'Please choose an end time.';
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
    endTime: fields.endTime || undefined,
    notes: fields.notes?.trim() || undefined,
    walkthroughRequested: fields.walkthroughRequested === true,
    alternateDate: fields.alternateDate || undefined,
    requestedSpaces: fields.requestedSpaces?.trim() || undefined,
    packageInterest: fields.packageInterest?.trim() || undefined,
    cateringBarNeeds: fields.cateringBarNeeds?.trim() || undefined,
    source: 'public_availability',
  };
}

export function bookAvailabilityPayload(fields: Pick<BookInquiryFields, 'eventDate' | 'space' | 'startTime'>) {
  return {
    eventDate: fields.eventDate,
    space: fields.space,
    ...(fields.startTime ? { startTime: fields.startTime } : {}),
  };
}

export function isAvailabilityChangedResponse(
  status: number,
  body: { error?: string; code?: string } | null | undefined,
): boolean {
  if (status !== 409) return false;
  if (body?.code === AVAILABILITY_CHANGED_CODE) return true;
  if (body?.error && /changed while you were completing/i.test(body.error)) return true;
  return false;
}

export function isRoomTakenResponse(
  status: number,
  body: { error?: string; available?: boolean; code?: string } | null | undefined,
): boolean {
  if (isAvailabilityChangedResponse(status, body)) return true;
  if (status === 409) return true;
  if (body?.available === false) return true;
  if (body?.error && /taken|double-book|already booked|overlaps/i.test(body.error)) return true;
  return false;
}
