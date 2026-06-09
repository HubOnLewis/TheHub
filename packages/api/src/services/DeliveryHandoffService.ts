import type { DeliveryPacketDoc } from '../repositories/DeliveryPacketRepository.js';

export type DeliveryHandoffReadinessLevel = 'not_ready' | 'almost_ready' | 'ready';

export interface DeliveryHandoffState {
  isCustomerReady: boolean;
  readinessLevel: DeliveryHandoffReadinessLevel;
  reasons: string[];
}

function closeoutOperational(closeout: {
  finalInspectionComplete?: boolean;
  customerFacingDocsComplete?: boolean;
  photosComplete?: boolean;
  punchItemsResolved?: boolean;
} | null | undefined): boolean {
  if (!closeout) return false;
  return !!(
    closeout.finalInspectionComplete &&
    closeout.customerFacingDocsComplete &&
    closeout.photosComplete &&
    closeout.punchItemsResolved
  );
}

function packetIncludesComplete(packet: DeliveryPacketDoc | null | undefined): boolean {
  if (!packet) return false;
  return !!(
    packet.includesPhotos &&
    packet.includesFinalSpecSummary &&
    packet.includesCustomerDocs &&
    packet.includesKeyContacts &&
    packet.deliveredVersionId
  );
}

/**
 * Denormalized display fields on packet (summary, flags) are not relational truth;
 * deliveredVersionId + issued status represent the controlled handoff boundary.
 */
export class DeliveryHandoffService {
  evaluate(
    deliveryRecord: { status: string },
    closeout: {
      finalInspectionComplete?: boolean;
      customerFacingDocsComplete?: boolean;
      photosComplete?: boolean;
      punchItemsResolved?: boolean;
    } | null | undefined,
    packet: DeliveryPacketDoc | null | undefined,
  ): DeliveryHandoffState {
    const co = closeoutOperational(closeout);
    const deliveredLike = deliveryRecord.status === 'delivered' || deliveryRecord.status === 'closed';
    const includesOk = packetIncludesComplete(packet);
    const issued = packet?.status === 'issued';

    let readinessLevel: DeliveryHandoffReadinessLevel = 'not_ready';
    if (deliveredLike && co && issued && includesOk) {
      readinessLevel = 'ready';
    } else if (deliveredLike && co && (!packet || !includesOk || !issued)) {
      readinessLevel = 'almost_ready';
    } else if (deliveredLike && !co) {
      readinessLevel = 'not_ready';
    } else if (!deliveredLike && packet && (packet.status === 'ready' || packet.status === 'issued')) {
      readinessLevel = co && includesOk && issued ? 'ready' : 'almost_ready';
    }

    const reasons: string[] = [];
    if (readinessLevel === 'ready') {
      reasons.push('Client handoff materials are ready');
    } else {
      if (!co) reasons.push('Event closeout checklist incomplete');
      if (!packet) reasons.push('Client packet is missing');
      else {
        if (!packet.deliveredVersionId) reasons.push('Approved proposal version not recorded on packet');
        if (!packet.includesPhotos) reasons.push('Client photos not marked complete on packet');
        if (!packet.includesFinalSpecSummary) reasons.push('Final scope summary not marked complete');
        if (!packet.includesCustomerDocs) reasons.push('Client-facing documents not marked complete');
        if (!packet.includesKeyContacts) reasons.push('Key contacts not marked complete on packet');
      }
      if (deliveredLike && packet && packet.status !== 'issued') {
        reasons.push('Handoff recorded but client packet has not been issued');
      }
    }

    const isCustomerReady = readinessLevel === 'ready';
    return {
      isCustomerReady,
      readinessLevel,
      reasons: Array.from(new Set(reasons)),
    };
  }
}

export const deliveryHandoffService = new DeliveryHandoffService();
