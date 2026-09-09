export const recordKinds = ['inquiry','proposal','booking','action'] as const;
export type RecordKind = typeof recordKinds[number];
export const stateGraphs: Record<RecordKind, Readonly<Record<string, readonly string[]>>> = {
  inquiry: { received:['qualifying','archived'],qualifying:['waiting_customer','ready','archived'],waiting_customer:['qualifying','archived'],ready:['qualifying','processed','archived'],processed:['qualifying','archived'],archived:['qualifying'] },
  proposal: { draft:['pending_approval','replaced'],pending_approval:['approved','refused','replaced'],approved:['sending','expired','replaced'],sending:['sent'],sent:['accepted','refused','expired','replaced'],accepted:['replaced'],refused:[],expired:[],replaced:[] },
  booking: { preparing:['sync_pending','cancelled'],sync_pending:['confirmed','reconciliation_required','cancelled'],confirmed:['reconciliation_required','change_requested','cancelled'],reconciliation_required:['confirmed','cancelled'],change_requested:['confirmed','cancelled'],cancelled:[] },
  action: { planned:['running','abandoned'],running:['succeeded','failed','uncertain'],succeeded:[],failed:['planned','abandoned'],uncertain:['succeeded','failed','abandoned'],abandoned:[] },
};

export function allowedTransition(kind: RecordKind, current: string, next: string): boolean {
  return Object.hasOwn(stateGraphs[kind],current) && (stateGraphs[kind][current]?.includes(next) ?? false);
}

// Graph membership is necessary, never sufficient authority for commercial effects.
// Only these foundation operations have a complete server command in this tranche.
export function foundationTransition(kind: RecordKind, current: string, next: string): boolean {
  if (!allowedTransition(kind,current,next)) return false;
  return kind==='inquiry' || (kind==='proposal'&&current==='draft'&&next==='pending_approval') ||
    (kind==='booking'&&current==='preparing'&&next==='cancelled') || (kind==='action'&&current==='planned'&&next==='abandoned');
}
