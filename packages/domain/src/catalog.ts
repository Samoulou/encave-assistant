export type CatalogFacts = {
  category: 'activity_fixed' | 'room_quote' | 'event_info';
  minimumParticipants: number | null; maximumParticipants: number | null;
  durationMode: 'fixed' | 'variable' | 'unknown'; durationMinutes: number | null;
  amountMinor: number | null; currency: 'CHF';
  taxMode: 'included' | 'excluded' | 'not_applicable' | 'unknown';
  taxRateBasisPoints: number | null; taxLabel: string | null; conditions: string | null;
  source: { verifiedAt: string; validUntil: string } | null;
};

// Eligibility for an automatic fixed activity; this does not prove availability.
export function catalogBlockers(definition: CatalogFacts | null, enabled: boolean, now: number): string[] {
  const reasons: string[] = [];
  if (!enabled) reasons.push('offer_disabled');
  if (!definition) return [...reasons, 'offer_unpublished'];
  if (definition.category !== 'activity_fixed') reasons.push('manual_offer_required');
  if (definition.minimumParticipants === null || definition.maximumParticipants === null) reasons.push('capacity_unknown');
  if (definition.durationMode !== 'fixed' || definition.durationMinutes === null) reasons.push('duration_unknown');
  if (definition.amountMinor === null) reasons.push('price_missing');
  if (definition.taxMode === 'unknown' || definition.taxRateBasisPoints === null || !definition.taxLabel) reasons.push('tax_rule_unknown');
  if (!definition.conditions) reasons.push('conditions_missing');
  if (!definition.source) reasons.push('source_missing');
  else if (!Number.isFinite(now) || !Number.isFinite(Date.parse(definition.source.verifiedAt)) || !Number.isFinite(Date.parse(definition.source.validUntil)) || Date.parse(definition.source.verifiedAt) > now || Date.parse(definition.source.validUntil) <= now) reasons.push('source_not_current');
  return reasons;
}
