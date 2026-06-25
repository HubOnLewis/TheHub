import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { CrmEventSourceManifest } from '../../lib/crmEventSource.js';
import { useAppStore } from '../../store/index.js';
import { ROUTES } from '../../config/paths.js';

type Props = {
  manifest: CrmEventSourceManifest;
};

function showDiagnostics(_manifest: CrmEventSourceManifest, isAdmin: boolean, pathname: string): boolean {
  if (!isAdmin) return false;
  return (
    pathname === `${ROUTES.settings}/data-import` ||
    pathname.endsWith('/data-import')
  );
}

export default function CrmEventSourceDiagnostics({ manifest }: Props) {
  const { pathname } = useLocation();
  const role = useAppStore(s => s.user?.role);
  const isAdmin = role === 'admin' || role === 'super_admin';
  const [open, setOpen] = useState(false);

  if (!showDiagnostics(manifest, isAdmin, pathname)) return null;

  return (
    <details
      className="crm-source-diagnostics"
      open={open}
      onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary>Imported data review — technical details</summary>
      <dl className="crm-source-diagnostics__grid">
        <div>
          <dt>Table source</dt>
          <dd>{manifest.tableSourceId}</dd>
        </div>
        <div>
          <dt>Metric source</dt>
          <dd>{manifest.metricSourceId}</dd>
        </div>
        <div>
          <dt>Mixed sources</dt>
          <dd>{manifest.mixedSources ? 'Yes (misconfiguration)' : 'No'}</dd>
        </div>
        <div>
          <dt>Completeness</dt>
          <dd>{manifest.completeness}</dd>
        </div>
        <div>
          <dt>Authoritative</dt>
          <dd>{manifest.authoritative ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt>Row count</dt>
          <dd>{manifest.rowCount}</dd>
        </div>
        <div>
          <dt>Last import</dt>
          <dd>{manifest.importedAt ?? '—'}</dd>
        </div>
        <div>
          <dt>Matches reference totals</dt>
          <dd>{manifest.matchesPvExpectedSummary ? 'Yes' : 'No'}</dd>
        </div>
        {manifest.skippedFallbackFrom ? (
          <div>
            <dt>Skipped incomplete source</dt>
            <dd>{manifest.skippedFallbackFrom}</dd>
          </div>
        ) : null}
      </dl>
      {manifest.pfTextStatus ? (
        <p className="crm-source-diagnostics__note">
          Text import: {manifest.pfTextStatus.completeness} — {manifest.pfTextStatus.parsedRowCount}/
          {manifest.pfTextStatus.expectedActiveEvents} rows parsed
        </p>
      ) : null}
      {manifest.validation.mismatches.length > 0 ? (
        <table className="crm-source-diagnostics__table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Type</th>
              <th>Expected</th>
              <th>Actual</th>
              <th>Delta</th>
            </tr>
          </thead>
          <tbody>
            {manifest.validation.mismatches.map(m => (
              <tr key={`${m.field}-${m.kind}`}>
                <td>{m.label}</td>
                <td>{m.kind}</td>
                <td>{m.kind === 'dollars' ? `$${m.expected.toLocaleString()}` : m.expected}</td>
                <td>{m.kind === 'dollars' ? `$${m.actual.toLocaleString()}` : m.actual}</td>
                <td>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="crm-source-diagnostics__ok">All metrics match reference totals.</p>
      )}
    </details>
  );
}
