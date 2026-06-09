import { isKpiDiagnosticsEnabled } from '../../config/demoChrome.js';
import type { VenueCommandState } from '../../data/venueCommandState.js';

type Props = {
  state: VenueCommandState;
};

/** Dev-only KPI trace — never shown in client demo */
export default function VenueCommandDiagnostics({ state }: Props) {
  if (!isKpiDiagnosticsEnabled()) return null;

  return (
    <details className="venue-command-diagnostics" style={{ marginBottom: 16 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
        KPI diagnostics (dev) · as of {state.asOf}
      </summary>
      <table
        className="venue-command-diagnostics__table"
        style={{ width: '100%', fontSize: 11, marginTop: 8, borderCollapse: 'collapse' }}
      >
        <thead>
          <tr>
            <th align="left">Metric</th>
            <th align="left">Value</th>
            <th align="left">Source</th>
            <th align="left">Formula</th>
          </tr>
        </thead>
        <tbody>
          {state.diagnostics.map(row => (
            <tr key={row.metric}>
              <td style={{ padding: '4px 8px 4px 0', verticalAlign: 'top' }}>{row.metric}</td>
              <td style={{ padding: '4px 8px 4px 0', fontWeight: 600 }}>{row.value}</td>
              <td style={{ padding: '4px 8px 4px 0', fontFamily: 'monospace', fontSize: 10 }}>
                {row.source}
              </td>
              <td style={{ padding: '4px 0', color: 'var(--text-secondary)' }}>{row.formula}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
