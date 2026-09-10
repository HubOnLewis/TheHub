/**
 * Leads queue authority — live Mongo CRM is primary; Perfect Venue import is secondary reference.
 */

export type LeadsQueueView = 'live' | 'imported';

export type LeadsQueueAuthorityInput = {
  isLoading: boolean;
  isError: boolean;
  /** Count of Mongo CRM leads returned (including Converted / Lost). */
  liveTotal: number;
  hasImportedRecords: boolean;
  /** Operator-selected secondary view. Default live. */
  selectedView: LeadsQueueView;
};

export type LeadsQueueAuthority = {
  /** Which panel to render as the working queue. */
  view: LeadsQueueView;
  /** Explicit source label for operators. */
  sourceLabel: 'LIVE CRM' | 'PERFECT VENUE IMPORT';
  /** True when live API answered successfully (even if empty). */
  liveApiOk: boolean;
  /** Show a control to open Perfect Venue import history. */
  allowImportedReference: boolean;
  /** Honest empty/error copy for the live queue. */
  liveHint: string | null;
};

/**
 * Live CRM owns the primary Leads experience whenever the API responds.
 * Imported Perfect Venue data never replaces a successful live response —
 * including when every live lead is already Converted (common after /book).
 */
export function resolveLeadsQueueAuthority(input: LeadsQueueAuthorityInput): LeadsQueueAuthority {
  const { isLoading, isError, liveTotal, hasImportedRecords, selectedView } = input;

  if (isLoading) {
    return {
      view: 'live',
      sourceLabel: 'LIVE CRM',
      liveApiOk: false,
      allowImportedReference: hasImportedRecords,
      liveHint: null,
    };
  }

  const liveApiOk = !isError;
  const allowImportedReference = hasImportedRecords;

  if (liveApiOk && selectedView === 'imported' && allowImportedReference) {
    return {
      view: 'imported',
      sourceLabel: 'PERFECT VENUE IMPORT',
      liveApiOk: true,
      allowImportedReference: true,
      liveHint: null,
    };
  }

  if (!liveApiOk) {
    return {
      view: 'live',
      sourceLabel: 'LIVE CRM',
      liveApiOk: false,
      allowImportedReference,
      liveHint: 'Could not load leads from the live CRM API.',
    };
  }

  return {
    view: 'live',
    sourceLabel: 'LIVE CRM',
    liveApiOk: true,
    allowImportedReference,
    liveHint:
      liveTotal === 0
        ? 'No live CRM leads yet — new /book inquiries and manually created leads appear here.'
        : null,
  };
}

/** Imported history must never present itself as the live CRM queue. */
export function importedMasqueradesAsLiveCrm(authority: LeadsQueueAuthority): boolean {
  return authority.view === 'imported' && authority.sourceLabel === 'LIVE CRM';
}
