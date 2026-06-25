/** Normalized HuB Perfect Venue refresh event — mirrors pipeline output. */

export type HubRefreshDocumentFlags = {
  eventSummary: boolean;
  beo: boolean;
  staffBeo: boolean;
  invoice: boolean;
  agreement: boolean;
  menu: boolean;
};

export type HubRefreshPayment = {
  id: string;
  pvPaymentId: string;
  pvEventId: string | null;
  pvId: string | null;
  eventId: string | null;
  eventName: string;
  payer: string;
  paymentDate: string | null;
  method: string;
  amount: number;
  paymentType: string;
  status: string;
  sourceFile: string;
  importBatchId: string;
  matchType: string | null;
};

export type HubRefreshEvent = {
  id: string;
  sourceKey: string;
  pvEventId: string;
  pvId: string | null;
  title: string;
  pvStatus: string;
  statusRaw: string;
  eventType: string;
  owner: string;
  contact: string;
  contactEmail: string;
  contactPhone: string;
  company: string;
  eventDateIso: string | null;
  startTime: string;
  endTime: string;
  guests: number;
  space: string;
  subtotal: number;
  discount: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  depositPaid: boolean;
  paidInFull: boolean;
  paymentCount: number;
  latestPaymentDate: string | null;
  createdOnIso: string | null;
  lastContactedIso: string | null;
  leadSource: string;
  sourceFile: string;
  documents: HubRefreshDocumentFlags;
  documentFiles: Partial<Record<keyof HubRefreshDocumentFlags, string>>;
  payments: HubRefreshPayment[];
  enrichmentNotes: string[];
};
