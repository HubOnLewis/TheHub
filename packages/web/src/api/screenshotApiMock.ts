import axios, { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { evaluateLiveVenueAgents, type LiveAgentEvent } from '@hub-crm/shared';
import { getScreenshotDemoUser, SCREENSHOT_DEMO_TOKEN } from '../config/screenshotSession.js';
import {
  createScreenshotDeal,
  deleteScreenshotDeal,
  getScreenshotDeal,
  listScreenshotDeals,
  updateScreenshotDeal,
} from './screenshotDealsStore.js';

function parseBody(config: InternalAxiosRequestConfig): Record<string, unknown> {
  const data = config.data;
  if (!data) return {};
  if (typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>;
  try {
    return JSON.parse(String(data)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function stripApiPrefix(pathname: string): string {
  let p = pathname;
  if (p.startsWith('/api')) p = p.slice(4) || '/';
  return p.startsWith('/') ? p : `/${p}`;
}

/** Resolved API path without query string (e.g. `/deals`, `/companies/x`). */
function screenshotApiPath(config: InternalAxiosRequestConfig): string {
  const base = (config.baseURL || '').replace(/\/$/, '');
  const raw = (config.url || '').split('?')[0] ?? '';
  const rel = raw.replace(/^\//, '');
  const joined = raw.startsWith('http')
    ? raw
    : `${base}/${rel}`.replace(/([^:])\/{2,}/g, '$1/');
  try {
    const u = new URL(joined.startsWith('http') ? joined : `http://local.invalid${joined.startsWith('/') ? '' : '/'}${joined}`);
    return stripApiPrefix(u.pathname);
  } catch {
    return stripApiPrefix(raw.startsWith('/') ? raw : `/${raw}`);
  }
}

function ok<T>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {},
    config,
    request: {},
  };
}

function rejectNotFound(config: InternalAxiosRequestConfig): Promise<never> {
  const response = {
    data: { error: 'Not Found' },
    status: 404,
    statusText: 'Not Found',
    headers: {},
    config,
  };
  return Promise.reject(new AxiosError('Not Found', 'ERR_BAD_REQUEST', config, {}, response));
}

const paginatedEmpty = { data: [] as unknown[], total: 0, page: 1, pages: 1, limit: 25 };

function emptyCompanySummary() {
  return {
    dealCount:         0,
    openPipelineTotal: 0,
    wonTotal:           0,
    nextFollowUp:       null,
    engagementState: {
      lastInteractionAt: null,
      daysSinceLastInteraction: null,
      openFollowUps: 0,
      overdueFollowUps: 0,
      nextActionSummary: null,
      isStale: false,
    },
    accountPenetrationState: {
      totalInteractions30d: 0,
      totalInteractions90d: 0,
      uniqueContacts30d: 0,
      uniqueContacts90d: 0,
      openDeals: 0,
      activeDeals: 0,
      stalledDeals: 0,
      criticalDeals: 0,
      openFollowUps: 0,
      overdueFollowUps: 0,
      penetrationLevel: 'low' as const,
      penetrationReasons: [],
      coverageRiskLevel: 'low' as const,
      coverageRiskReasons: [],
      whitespaceSignals: [],
    },
    accountCoverageWarnings: [],
    accountExpansionState: {
      expansionReadiness: 'low' as const,
      expansionReasons: [],
      blockers: [],
      opportunitySignals: [],
      hasActiveExpansionMotion: false,
      hasOpenPipeline: false,
      hasRecentActivity: false,
      planningPriority: 'low' as const,
      planningReasons: [],
    },
    customerDeliveryContext: {
      recentDeliveredUnits: [],
      pendingPostDeliveryFollowUps: [],
      customerHandoffWarnings: [],
    },
  };
}

function demoCompany(id: string) {
  const now = new Date().toISOString();
  return {
    _id: id,
    tenantId: 'hub-wichita',
    name: 'Demo Account',
    source: 'screenshot',
    sourceId: 'screenshot-demo',
    isStub: true,
    phone: '',
    address: { city: 'Wichita', state: 'KS' },
    createdAt: now,
    updatedAt: now,
  };
}

function mockResponse(config: InternalAxiosRequestConfig): AxiosResponse | Promise<AxiosResponse> {
  const method = (config.method || 'get').toLowerCase();
  const path = screenshotApiPath(config);
  const demoUser = getScreenshotDemoUser();

  if (method === 'post' && path === '/auth/login') {
    return ok(config, { token: SCREENSHOT_DEMO_TOKEN, user: demoUser });
  }

  if (method === 'get' && path === '/dashboard/stats') {
    const deals = listScreenshotDeals();
    const dealsByStatusMap = new Map<string, number>();
    for (const d of deals) {
      dealsByStatusMap.set(d.status, (dealsByStatusMap.get(d.status) ?? 0) + 1);
    }
    return ok(config, {
      leadsByStatus: [],
      dealsByStatus: [...dealsByStatusMap.entries()].map(([_id, count]) => ({ _id, count })),
      forecastAmounts: { commit: 0, best_case: 0, pipeline: deals.reduce((n, d) => n + (d.amount || 0), 0), excluded: 0 },
      commitAmount: 0,
      bestCaseAmount: 0,
      dealsNeedingManagementReview: 0,
      lowConfidenceLateStageDeals: 0,
      followUpOverdueOpen: 0,
    });
  }

  if (method === 'get' && path === '/deals/pipeline-pressure') {
    return ok(config, { grouped: { critical: [], high: [], medium: [], low: [] } });
  }

  if (method === 'get' && path === '/deals/forecast-review') {
    return ok(config, { grouped: { needsReview: [], lowConfidence: [], commit: [], bestCase: [] } });
  }

  const dealInteractions = /^\/deals\/([^/]+)\/interactions$/.exec(path);
  if (method === 'get' && dealInteractions) {
    return ok(config, []);
  }

  if (method === 'post' && path === '/deals') {
    const body = parseBody(config);
    const deal = createScreenshotDeal({
      title: String(body.title ?? 'Untitled event'),
      company: String(body.company ?? 'Client'),
      contact: String(body.contact ?? 'Contact'),
      amount: typeof body.amount === 'number' ? body.amount : Number(body.amount) || 0,
      assignedTo: typeof body.assignedTo === 'string' ? body.assignedTo : demoUser.name,
      notes: typeof body.notes === 'string' ? body.notes : undefined,
      status: typeof body.status === 'string' ? body.status : 'Draft',
      importMeta:
        body.importMeta && typeof body.importMeta === 'object'
          ? (body.importMeta as Record<string, unknown>)
          : undefined,
      ownerUserId: demoUser.id,
    });
    return ok(config, deal, 201);
  }

  const dealById = /^\/deals\/([^/]+)$/.exec(path);
  if (dealById) {
    const dealId = dealById[1]!;
    if (method === 'get') {
      const deal = getScreenshotDeal(dealId);
      if (!deal) return rejectNotFound(config);
      return ok(config, deal);
    }
    if (method === 'patch') {
      const body = parseBody(config);
      const updated = updateScreenshotDeal(dealId, body as never);
      if (!updated) return rejectNotFound(config);
      return ok(config, updated);
    }
    if (method === 'delete') {
      if (!deleteScreenshotDeal(dealId)) return rejectNotFound(config);
      return ok(config, { ok: true });
    }
  }

  if (method === 'get' && path === '/deals') {
    const deals = listScreenshotDeals();
    return ok(config, {
      data: deals,
      total: deals.length,
      page: 1,
      pages: 1,
      limit: 500,
    });
  }

  if (method === 'post' && path === '/interactions') {
    return ok(config, {
      _id: `ss-ix-${Date.now().toString(36)}`,
      ok: true,
      createdAt: new Date().toISOString(),
    }, 201);
  }

  if (method === 'get' && path === '/ai/status') {
    return ok(config, {
      enabled: false,
      configured: false,
      reachable: null,
      provider: 'none',
      mode: 'off',
      model: null,
      baseUrlHost: null,
      message: 'Screenshot mode — wire Ollama on the always-on host for live AI drafts.',
      lastProbeAt: null,
      lastProbeError: null,
      productMode: 'venue',
    });
  }

  if (method === 'post' && path === '/ai/enhance') {
    return ok(config, {
      output: '',
      enhanced: false,
      provider: 'none',
      model: null,
      mode: 'off',
      error: 'Screenshot mode — local model is not connected.',
    });
  }

  const portalLink = /^\/portal\/links\/([^/]+)$/.exec(path);
  if (method === 'post' && portalLink) {
    const dealId = decodeURIComponent(portalLink[1] ?? '');
    const deal = getScreenshotDeal(dealId);
    if (!deal) return rejectNotFound(config);
    const token = `ss.${dealId}`;
    return ok(config, {
      token,
      eventId: dealId,
      path: `/portal/login?access=${encodeURIComponent(token)}`,
    });
  }

  const publicBooking = /^\/public\/portal\/bookings\/([^/]+)$/.exec(path);
  if (method === 'get' && publicBooking) {
    const token = decodeURIComponent(publicBooking[1] ?? '');
    const dealId = token.startsWith('ss.') ? token.slice(3) : token;
    const deal = getScreenshotDeal(dealId);
    if (!deal) return rejectNotFound(config);
    const meta = deal.importMeta ?? {};
    const grandTotal = typeof meta.grandTotal === 'number' ? meta.grandTotal : deal.amount;
    const amountPaid = typeof meta.amountPaid === 'number' ? meta.amountPaid : 0;
    const balanceDue = typeof meta.balanceDue === 'number' ? meta.balanceDue : Math.max(0, grandTotal - amountPaid);
    const profile = {
      id: deal._id,
      title: deal.title,
      clientName: deal.company,
      contactName: deal.contact,
      contactEmail: typeof meta.contactEmail === 'string' ? meta.contactEmail : null,
      displayDate: typeof meta.eventDateIso === 'string' ? meta.eventDateIso : 'Date TBD',
      eventStartIso: typeof meta.eventDateIso === 'string' ? meta.eventDateIso : null,
      venueName: 'HuB on Lewis',
      venueAddress: '1400 N Lewis St · Wichita, KS',
      coordinator: { name: deal.assignedTo ?? 'Your coordinator', email: 'coordinator@hubonlewis.com', phone: '' },
      packageTotal: grandTotal,
      paidTotal: amountPaid,
      balanceDue,
      guests: typeof meta.guests === 'number' ? meta.guests : 0,
      space: typeof meta.space === 'string' ? meta.space : 'Event Space',
      notes: deal.notes ?? '',
      source: 'crm' as const,
    };
    return ok(config, {
      eventId: dealId,
      profile,
      proposal: null,
      payments: [],
      messages: [],
      timeline: [
        { key: 'inquiry', label: 'Inquiry', state: 'complete' },
        { key: 'proposal', label: 'Proposal', state: 'current', detail: 'Not sent yet' },
        { key: 'signed', label: 'Signed', state: 'upcoming' },
        { key: 'deposit', label: 'Deposit', state: 'upcoming' },
        { key: 'details', label: 'Details', state: 'upcoming' },
        { key: 'final_pay', label: 'Final pay', state: 'upcoming' },
        { key: 'day_of', label: 'Day-of', state: 'upcoming' },
      ],
      nextDates: profile.eventStartIso ? [{ label: 'Event date', date: profile.eventStartIso }] : [],
      documents: [
        { kind: 'proposal', label: 'Proposal & agreement', audience: 'guest', available: false },
        { kind: 'beo_guest', label: 'Event details / BEO (guest)', audience: 'guest', available: true },
        { kind: 'payment_summary', label: 'Payment summary', audience: 'guest', available: true },
      ],
    });
  }

  if (method === 'get' && path === '/proposals') {
    return ok(config, { data: [] });
  }
  if (method === 'get' && path === '/comms') {
    return ok(config, { data: [] });
  }
  if (method === 'get' && path === '/comms/inbox') {
    return ok(config, {
      unansweredMessages: [],
      unsignedProposals: [],
      unpaidDeposits: [],
      drafts: [],
      scheduled: [],
      templates: [],
    });
  }
  if (method === 'get' && path === '/comms/templates') {
    return ok(config, { data: [] });
  }

  if ((method === 'get' && path === '/agents/snapshot') || (method === 'post' && path === '/agents/evaluate')) {
    const events: LiveAgentEvent[] = listScreenshotDeals().map(d => {
      const meta = d.importMeta ?? {};
      const value = typeof meta.grandTotal === 'number' ? meta.grandTotal : d.amount;
      const amountPaid = typeof meta.amountPaid === 'number' ? meta.amountPaid : 0;
      return {
        id: d._id,
        title: d.title,
        contact: d.contact,
        status: d.status,
        pvStatus: typeof meta.pvStatus === 'string' ? meta.pvStatus : null,
        eventDateIso: typeof meta.eventDateIso === 'string' ? meta.eventDateIso : null,
        value,
        amountPaid,
        balanceDue: typeof meta.balanceDue === 'number' ? meta.balanceDue : Math.max(0, value - amountPaid),
        guests: typeof meta.guests === 'number' ? meta.guests : 0,
        space: typeof meta.space === 'string' ? meta.space : null,
        updatedAt: d.updatedAt,
      };
    });
    const evaluation = evaluateLiveVenueAgents(events, []);
    return ok(config, {
      _id: 'ss-agent-run',
      generatedAt: evaluation.generatedAt,
      evaluation,
      llmBriefing: null,
      decisions: [],
    });
  }

  if (method === 'post' && path === '/agents/approvals') {
    return ok(config, { ok: true });
  }

  if (method === 'get' && path === '/leads') {
    return ok(config, { ...paginatedEmpty });
  }

  if (method === 'get' && path === '/companies') {
    return ok(config, { ...paginatedEmpty });
  }

  if (method === 'get' && path === '/companies/search') {
    return ok(config, []);
  }

  const companyPlanGet = /^\/companies\/([^/]+)\/account-plan$/.exec(path);
  if (method === 'get' && companyPlanGet) {
    return ok(config, null);
  }

  const companySummaryGet = /^\/companies\/([^/]+)\/summary$/.exec(path);
  if (method === 'get' && companySummaryGet) {
    return ok(config, emptyCompanySummary());
  }

  const companyInteractions = /^\/companies\/([^/]+)\/interactions$/.exec(path);
  if (method === 'get' && companyInteractions) {
    return ok(config, { ...paginatedEmpty });
  }

  const companyById = /^\/companies\/([^/]+)$/.exec(path);
  if (method === 'get' && companyById) {
    return ok(config, demoCompany(companyById[1]));
  }

  if (method === 'get' && path === '/admin/users') {
    return ok(config, []);
  }

  if (method === 'get' && path === '/admin/stats') {
    return ok(config, {
      leadsByTenant: [],
      dealsByTenant: [],
      leadsByStatus: [],
      dealsByStatus: [],
    });
  }

  if (method === 'get' && path === '/admin/sync-status') {
    return ok(config, []);
  }

  if (method === 'get' && path === '/builds') {
    return ok(config, { ...paginatedEmpty });
  }

  const buildVersions = /^\/builds\/([^/]+)\/versions$/.exec(path);
  if (method === 'get' && buildVersions) {
    return ok(config, { data: [] });
  }

  const buildCO = /^\/builds\/([^/]+)\/change-orders$/.exec(path);
  if (method === 'get' && buildCO) {
    return ok(config, { data: [] });
  }

  const buildDiff = /^\/builds\/([^/]+)\/diff$/.exec(path);
  if (method === 'get' && buildDiff) {
    return ok(config, {
      addedItems: [],
      removedItems: [],
      modifiedItems: [],
      costDelta: 0,
      sellDelta: 0,
      marginDelta: 0,
      changeSummary: [],
    });
  }

  const buildById = /^\/builds\/([^/]+)$/.exec(path);
  if (method === 'get' && buildById) {
    return ok(config, {
      _id: buildById[1],
      name: 'Screenshot proposal',
      status: 'draft',
      tenantId: 'hub-wichita',
    });
  }

  if (method === 'get' && path === '/units') {
    return ok(config, { ...paginatedEmpty });
  }

  if (method === 'get' && path === '/units/summary') {
    return ok(config, []);
  }

  const unitById = /^\/units\/([^/]+)$/.exec(path);
  if (method === 'get' && unitById) {
    return ok(config, {
      _id: unitById[1],
      companyId: 'demo',
      make: 'Demo',
      model: 'Unit',
      spec: '',
      color: '',
      status: 'prospect',
      entity: 'HUB',
      location: 'Wichita',
      msrp: 0,
      notes: '',
      updatedAt: new Date().toISOString(),
    });
  }

  if (method === 'get' && path === '/production') {
    return ok(config, { ...paginatedEmpty });
  }

  const productionById = /^\/production\/([^/]+)$/.exec(path);
  if (method === 'get' && productionById) {
    return ok(config, { _id: productionById[1], tenantId: 'hub-wichita', status: 'planned' });
  }

  const productionTasks = /^\/production\/([^/]+)\/tasks$/.exec(path);
  if (method === 'get' && productionTasks) {
    return ok(config, []);
  }

  if (method === 'get' && path === '/delivery') {
    return ok(config, { ...paginatedEmpty });
  }

  const deliveryById = /^\/delivery\/([^/]+)$/.exec(path);
  if (method === 'get' && deliveryById) {
    return ok(config, { _id: deliveryById[1], tenantId: 'hub-wichita', status: 'pending' });
  }

  const deliveryCloseout = /^\/delivery\/production-job\/([^/]+)\/closeout$/.exec(path);
  if (method === 'get' && deliveryCloseout) {
    return ok(config, {});
  }

  if (method === 'get' && path === '/interactions/follow-ups') {
    return ok(config, { ...paginatedEmpty, limit: 100 });
  }

  if (method === 'get' && path === '/interactions/my-work') {
    return ok(config, { overdue: [], dueToday: [], upcoming: [], suggested: [] });
  }

  const interactionById = /^\/interactions\/([^/]+)$/.exec(path);
  if (method === 'get' && interactionById) {
    const id = interactionById[1];
    const now = new Date().toISOString();
    return ok(config, {
      _id: id,
      companyId: 'screenshot-company',
      companyName: 'Demo Account',
      type: 'note',
      direction: 'outbound',
      summary: 'Screenshot demo interaction',
      body: '',
      outcome: 'logged',
      status: 'open',
      createdAt: now,
      createdByUserId: 'screenshot-hub-admin',
      createdByName: 'Jason Lavender',
      ownerUserId: 'screenshot-hub-admin',
      ownerName: 'Jason Lavender',
      attachments: [],
      metadata: {},
    });
  }

  if (method === 'get' && path === '/account-coverage') {
    return ok(config, []);
  }

  if (method === 'get' && path === '/account-expansion') {
    return ok(config, []);
  }

  if (method === 'get' && path === '/account-plans') {
    return ok(config, { ...paginatedEmpty });
  }

  if (method === 'get' && path === '/rep-scorecards') {
    return ok(config, []);
  }

  const repOne = /^\/rep-scorecards\/([^/]+)$/.exec(path);
  if (method === 'get' && repOne) {
    return ok(config, null);
  }

  if (method === 'get' && path === '/weekly-cadence-reviews') {
    return ok(config, { ...paginatedEmpty });
  }

  if (method === 'post' || method === 'patch' || method === 'put' || method === 'delete') {
    return ok(config, { ok: true, _id: 'screenshot-mock-id' });
  }

  if (method === 'get') {
    return ok(config, {});
  }

  return ok(config, {});
}

export function createScreenshotMockAdapter(): AxiosAdapter {
  return config => Promise.resolve(mockResponse(config));
}
