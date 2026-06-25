import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@hub-crm/shared';
import client from '../../api/client.js';
type AdminStats = {
  leadsByStatus?: Array<{ _id: string; count: number }>;
  dealsByStatus?: Array<{ _id: string; count: number; totalAmount: number }>;
};

type MetricRow = { label: string; value: string; available: boolean };

function sumStatus(rows: Array<{ _id: string; count: number }> | undefined, statuses: string[]): number {
  if (!rows) return 0;
  return rows.filter(r => statuses.includes(r._id)).reduce((n, r) => n + r.count, 0);
}

function sumDealAmount(rows: AdminStats['dealsByStatus'], statuses: string[]): number {
  if (!rows) return 0;
  return rows.filter(r => statuses.includes(r._id)).reduce((n, r) => n + r.totalAmount, 0);
}

export default function MonthlyScorecard() {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => client.get<AdminStats>('/admin/stats').then(r => r.data),
    staleTime: 60_000,
    retry: false,
  });

  const metrics: MetricRow[] = useMemo(() => {
    const apiAvailable = !isError && !isLoading && Boolean(stats);

    const newLeads = apiAvailable ? sumStatus(stats?.leadsByStatus, ['New']) : null;
    const convertedLeads = apiAvailable ? sumStatus(stats?.leadsByStatus, ['Converted']) : null;
    const bookedEvents = apiAvailable
      ? sumStatus(stats?.dealsByStatus?.map(d => ({ _id: d._id, count: d.count })), ['Won', 'Approved', 'In Build'])
      : null;
    const completedEvents = apiAvailable
      ? sumStatus(stats?.dealsByStatus?.map(d => ({ _id: d._id, count: d.count })), ['Delivered'])
      : null;
    const collectedRevenue = apiAvailable
      ? sumDealAmount(stats?.dealsByStatus, ['Won', 'Delivered', 'In Build'])
      : null;
    const outstandingRevenue = apiAvailable
      ? sumDealAmount(stats?.dealsByStatus, ['Approved', 'Pending Approval', 'Draft'])
      : null;

    const fmt = (label: string, n: number | null, money = false): MetricRow => ({
      label,
      value: n === null ? 'Not available yet' : money ? formatCurrency(n) : String(n),
      available: n !== null,
    });

    const rows: MetricRow[] = [
      fmt('New leads', newLeads),
      fmt('Converted leads', convertedLeads),
      fmt('Booked events', bookedEvents),
      fmt('Completed events', completedEvents),
      fmt('Collected revenue', collectedRevenue, true),
      fmt('Outstanding revenue', outstandingRevenue, true),
    ];

    return rows;
  }, [stats, isError, isLoading]);

  return (
    <section className="card monthly-scorecard">
      <div className="monthly-scorecard__grid">
        {metrics.map(m => (
          <div key={m.label} className={`monthly-scorecard__cell${m.available ? '' : ' monthly-scorecard__cell--na'}`}>
            <div className="monthly-scorecard__label">{m.label}</div>
            <div className="monthly-scorecard__value">
              {isLoading && !m.available && m.value === 'Not available yet' ? '…' : m.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}