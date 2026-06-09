export const EVENT_FINALIZATION_ITEMS = [
  { id: 'guest_count', label: 'Final guest count confirmed', required: true },
  { id: 'room_layout', label: 'Final room/layout confirmed', required: true },
  { id: 'menu_package', label: 'Final menu/package confirmed', required: true },
  { id: 'deposit_payment', label: 'Deposit/payment status reviewed', required: true },
  { id: 'final_balance', label: 'Final balance reviewed', required: true },
  { id: 'contract_proposal', label: 'Contract/proposal confirmed', required: true },
  { id: 'staff_notes', label: 'Staff/internal notes reviewed', required: true },
  { id: 'setup_teardown', label: 'Setup/teardown timing confirmed', required: true },
  { id: 'client_confirmation', label: 'Client final confirmation sent', required: true },
  { id: 'ready_execution', label: 'Event marked ready for execution', required: true },
] as const;

export type EventFinalizationItemId = (typeof EVENT_FINALIZATION_ITEMS)[number]['id'];

export interface EventFinalizationState {
  dealId: string;
  completed: Partial<Record<EventFinalizationItemId, boolean>>;
  updatedAt: string;
  updatedBy?: string;
}
