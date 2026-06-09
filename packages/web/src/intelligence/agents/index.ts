import { runBalanceGuardian } from './balanceGuardian.js';
import { runBookingCoordinator } from './bookingCoordinator.js';
import { runCalendarConflict } from './calendarConflict.js';
import { runClientReadiness } from './clientReadiness.js';
import { runFollowUpHunter } from './followUpHunter.js';
import { runOwnerBriefing } from './ownerBriefing.js';
import { runRevenueLift } from './revenueLift.js';
import { runReviewReferral } from './reviewReferral.js';
import type { AgentRunner } from './types.js';

export const AGENT_RUNNERS: AgentRunner[] = [
  runBalanceGuardian,
  runFollowUpHunter,
  runBookingCoordinator,
  runCalendarConflict,
  runOwnerBriefing,
  runRevenueLift,
  runReviewReferral,
  runClientReadiness,
];
