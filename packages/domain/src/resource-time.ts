import { Temporal } from '@js-temporal/polyfill';

export type WeeklySlot = { weekday: number; from: string; to: string };
export type ResourceTimeRules = {
  timeZone: string; hoursMode: 'unknown'|'always'|'weekly'; weeklyHours: WeeklySlot[];
  sourceTruth: 'unknown'|'internal_controlled'|'microsoft_resource'|'external_uncontrolled'; sourcePolicy: string|null;
};
export class ResourceTimeError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}
export function validResourceTimeZone(value: string): boolean {
  if (value !== 'UTC' && !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+$/.test(value)) return false;
  try { new Intl.DateTimeFormat('en',{timeZone:value}); return true; } catch { return false; }
}
export function localInstant(local: string, timeZone: string, offset: string|null = null): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) || !validResourceTimeZone(timeZone) ||
    (offset !== null && !/^[+-]\d{2}:\d{2}$/.test(offset))) throw new ResourceTimeError('invalid_local_time');
  try {
    const plain = Temporal.PlainDateTime.from(local,{overflow:'reject'});
    return Temporal.ZonedDateTime.from({timeZone,year:plain.year,month:plain.month,day:plain.day,hour:plain.hour,minute:plain.minute,
      ...(offset === null ? {} : {offset})},{overflow:'reject',disambiguation:'reject',offset:'reject'}).epochMilliseconds;
  } catch { throw new ResourceTimeError('invalid_local_time'); }
}
const minutes = (value: number, minimum: number, maximum: number) => Number.isInteger(value) && value >= minimum && value <= maximum;
export function occupationWindow(start: number, durationMinutes: number, beforeMinutes: number, afterMinutes: number) {
  if (!Number.isSafeInteger(start) || !Number.isFinite(new Date(start).valueOf()) || !minutes(durationMinutes,1,43200) ||
    !minutes(beforeMinutes,0,1440) || !minutes(afterMinutes,0,1440)) throw new ResourceTimeError('invalid_duration');
  const end = start + durationMinutes * 60000, occupiedStart = start - beforeMinutes * 60000, occupiedEnd = end + afterMinutes * 60000;
  if (!Number.isFinite(new Date(occupiedStart).valueOf()) || !Number.isFinite(new Date(occupiedEnd).valueOf())) throw new ResourceTimeError('invalid_duration');
  return {start,end,occupiedStart,occupiedEnd};
}
export function overlap(start: number, end: number, otherStart: number, otherEnd: number): boolean {
  return start < otherEnd && end > otherStart;
}
export function localDescription(instant: number, timeZone: string) {
  const value = Temporal.Instant.fromEpochMilliseconds(instant).toZonedDateTimeISO(timeZone);
  return {utc:new Date(instant).toISOString(),local:value.toPlainDateTime().toString({smallestUnit:'minute'}),timeZone,offset:value.offset};
}

export function hoursBlockers(start: number, end: number, rules: ResourceTimeRules): string[] {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end <= start || end-start > 32*86400000 || !validResourceTimeZone(rules.timeZone)) return ['invalid_occupation_window'];
  if (rules.hoursMode === 'unknown') return ['hours_unknown'];
  if (rules.hoursMode === 'always') return [];
  const windows: Array<{start:number;end:number}> = [];
  try {
    let day = Temporal.Instant.fromEpochMilliseconds(start).toZonedDateTimeISO(rules.timeZone).toPlainDate();
    const last = Temporal.Instant.fromEpochMilliseconds(end-1).toZonedDateTimeISO(rules.timeZone).toPlainDate();
    for (let count=0; Temporal.PlainDate.compare(day,last)<=0; count++,day=day.add({days:1})) {
      if (count>=34) return ['invalid_occupation_window'];
      for (const slot of rules.weeklyHours.filter(item=>item.weekday===day.dayOfWeek)) {
        const first = localInstant(day.toString()+'T'+slot.from,rules.timeZone);
        const final = slot.to === '24:00' ? localInstant(day.add({days:1}).toString()+'T00:00',rules.timeZone) : localInstant(day.toString()+'T'+slot.to,rules.timeZone);
        if (final<=first) return ['invalid_hours_configuration'];
        windows.push({start:first,end:final});
      }
    }
  } catch { return ['ambiguous_hours_configuration']; }
  let covered = start;
  for (const window of windows.sort((a,b)=>a.start-b.start)) {
    if (window.start > covered) break;
    if (window.end > covered) covered = window.end;
    if (covered >= end) return [];
  }
  return ['outside_hours'];
}
export function resourceWindowBlockers(start: number, end: number, rules: ResourceTimeRules, enabled: boolean,
  closures: Array<{start:number;end:number}>) {
  const reasons = hoursBlockers(start,end,rules);
  if (!enabled) reasons.push('resource_disabled');
  if (rules.sourceTruth === 'unknown' || !rules.sourcePolicy) reasons.push('source_unknown');
  else if (rules.sourceTruth !== 'internal_controlled') reasons.push('external_verification_required');
  if (closures.some(item=>overlap(start,end,item.start,item.end))) reasons.push('resource_closed');
  return reasons;
}
