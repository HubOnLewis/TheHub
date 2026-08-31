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
