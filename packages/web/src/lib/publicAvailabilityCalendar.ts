export type PublicDayStatus = 'available' | 'hold' | 'booked' | 'closed';

export type CalendarCell = {
  date: string | null;
  inMonth: boolean;
  status?: PublicDayStatus;
};

export function monthLabel(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function buildMonthCells(year: number, monthIndex: number): CalendarCell[] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startWeekday = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push({ date: null, inMonth: false });
  for (let day = 1; day <= daysInMonth; day += 1) {
    const mm = String(monthIndex + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    cells.push({ date: `${year}-${mm}-${dd}`, inMonth: true });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, inMonth: false });
  return cells;
}

export function statusLabel(status: PublicDayStatus): string {
  if (status === 'available') return 'Available';
  if (status === 'hold') return 'On hold';
  if (status === 'booked') return 'Booked';
  return 'Closed';
}
