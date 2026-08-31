import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client.js';
import { leadDetailPath, opportunityDetailPath } from '../config/paths.js';
import type { LiveAgentEvaluation, LiveAgentFinding } from '@hub-crm/shared';
import type { CrmEventRow } from '../lib/crmEvents.js';
import {
  buildAttentionQueue,
  type AttentionItem,
} from '../venue/liveIntelligence.js';

export type AgentRunPayload = {
  _id: string;
  generatedAt: string;
  evaluation: LiveAgentEvaluation;
  llmBriefing?: string | null;
  decisions?: Array<{ findingId: string; decision: 'approve' | 'dismiss'; at: string; by?: string }>;
};

export function findingHref(f: LiveAgentFinding): string {
  return f.entityKind === 'lead' ? leadDetailPath(f.entityId) : opportunityDetailPath(f.entityId);
}

export function findingsToAttentionItems(findings: LiveAgentFinding[]): AttentionItem[] {
  return findings.map(f => ({
    id: f.id,
    priority: f.priority,
    title: f.title,
    detail: f.detail,
    eventId: f.entityId,
    eventTitle: f.title,
    href: findingHref(f),
    agent: f.agentLabel,
    actionLabel: f.actionLabel,
    amount: f.amount,
  }));
}

export function useAgentSnapshot() {
  return useQuery({
    queryKey: ['agents', 'snapshot'],
    queryFn: () => client.get<AgentRunPayload>('/agents/snapshot').then(r => r.data),
    staleTime: 60_000,
    retry: false,
  });
}

export function useAgentMutations() {
  const qc = useQueryClient();
  const evaluate = useMutation({
    mutationFn: () => client.post<AgentRunPayload>('/agents/evaluate').then(r => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['agents'] }),
  });
  const decide = useMutation({
    mutationFn: (body: { findingId: string; decision: 'approve' | 'dismiss' }) =>
      client.post('/agents/approvals', body).then(r => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['agents'] }),
  });
  return { evaluate, decide };
}

/** Production Home / Tasks / Briefing queue. Prefers persisted CRM agent run; never Perfect Venue seed. */
export function useVenueAttention(rows: CrmEventRow[]) {
  const snapshotQuery = useAgentSnapshot();
  const local = useMemo(() => buildAttentionQueue(rows), [rows]);

  const remote = useMemo(() => {
    const evaluation = snapshotQuery.data?.evaluation;
    if (!evaluation?.findings?.length) return null;
    const dismissed = new Set(
      (snapshotQuery.data?.decisions ?? [])
        .filter(d => d.decision === 'dismiss')
        .map(d => d.findingId),
    );
    const findings = evaluation.findings.filter(f => !dismissed.has(f.id));
    return findings.length ? findingsToAttentionItems(findings) : null;
  }, [snapshotQuery.data]);

  const items = remote ?? local;
  const source = remote ? ('api-agents' as const) : ('live-rules' as const);

  return {
    items,
    snapshot: snapshotQuery.data ?? null,
    snapshotQuery,
    source,
    headline: snapshotQuery.data?.evaluation?.briefingHeadline ?? null,
    summary: snapshotQuery.data?.evaluation?.briefingSummary ?? null,
    llmBriefing: snapshotQuery.data?.llmBriefing ?? null,
  };
}
