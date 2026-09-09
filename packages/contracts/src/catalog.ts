import { z } from 'zod';

const text = (maximum: number) => z.string().trim().min(1).max(maximum);
const count = z.number().int().min(1).max(100000).nullable();
const timestamp = z.string().refine(value => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}, 'Canonical UTC timestamp required');
const officialUrl = text(2048).refine(value => {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}, 'Official HTTPS URL required').nullable();

export const catalogDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  title: text(160), category: z.enum(['activity_fixed', 'room_quote', 'event_info']),
  minimumParticipants: count, maximumParticipants: count,
  durationMode: z.enum(['fixed', 'variable', 'unknown']), durationMinutes: z.number().int().min(1).max(43200).nullable(),
  amountMinor: z.number().int().min(0).max(1000000000).nullable(), currency: z.literal('CHF'),
  priceUnit: z.enum(['per_person', 'per_group']),
  taxMode: z.enum(['included', 'excluded', 'not_applicable', 'unknown']),
  taxRateBasisPoints: z.number().int().min(0).max(10000).nullable(), taxLabel: text(240).nullable(),
  conditions: text(2000).nullable(),
  source: z.object({ label: text(160), reference: text(1024), verifiedAt: timestamp, validUntil: timestamp }).strict().nullable(),
  officialUrl,
}).strict().superRefine((value, context) => {
  const invalid = (message: string) => context.addIssue({ code: 'custom', message });
  if (value.minimumParticipants !== null && value.maximumParticipants !== null && value.minimumParticipants > value.maximumParticipants) invalid('Participant range is inverted');
  if (value.durationMode !== 'fixed' && value.durationMinutes !== null) invalid('Variable or unknown duration has no fixed minutes');
  if (value.category === 'activity_fixed' && value.durationMode === 'variable') invalid('Fixed activity cannot have variable duration');
  if (value.category === 'room_quote' && value.durationMode === 'fixed') invalid('Room quotation cannot use a fixed activity duration');
  if (value.taxMode === 'unknown' && (value.taxRateBasisPoints !== null || value.taxLabel !== null)) invalid('Unknown tax rule cannot claim a rate');
  if (value.taxMode === 'not_applicable' && value.taxRateBasisPoints !== null && value.taxRateBasisPoints !== 0) invalid('Non-applicable taxes cannot have a positive rate');
  if (value.source && Date.parse(value.source.validUntil) <= Date.parse(value.source.verifiedAt)) invalid('Source validity must follow verification');
});
export type CatalogDefinition = z.infer<typeof catalogDefinitionSchema>;
export const catalogExpectedVersionSchema = z.number().int().min(1).max(2147483647);
export const catalogCreateSchema = z.object({ definition: catalogDefinitionSchema }).strict();
export const catalogReviseSchema = z.object({ expectedVersion: catalogExpectedVersionSchema, definition: catalogDefinitionSchema }).strict();
export const catalogPublishSchema = z.object({ expectedVersion: catalogExpectedVersionSchema, versionId: z.uuid() }).strict();
export const catalogEnableSchema = z.object({ expectedVersion: catalogExpectedVersionSchema, enabled: z.boolean() }).strict();
export const catalogSelectSchema = z.object({ versionId: z.uuid() }).strict();
