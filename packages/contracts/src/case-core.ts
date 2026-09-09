import { z } from 'zod';

// Independent state vocabularies; legal transitions are the EA-08 domain service.
export const inquiryState = z.enum(['received','qualifying','waiting_customer','ready','processed','archived']);
export const proposalState = z.enum(['draft','pending_approval','approved','sending','sent','accepted','refused','expired','replaced']);
export const bookingState = z.enum(['preparing','sync_pending','confirmed','reconciliation_required','change_requested','cancelled']);
export const actionState = z.enum(['planned','running','succeeded','failed','uncertain','abandoned']);
export const recordVersion = z.number().int().min(1).max(2147483647);
export const termsHash = z.string().regex(/^[a-f0-9]{64}$/);
export const caseIdentity = z.object({ id: z.uuid(), caveId: z.uuid(), version: recordVersion, state: inquiryState }).strict();
