export const roles = ['admin', 'operator', 'reader'] as const;
export type Role = typeof roles[number];
export type TeamAction = 'read' | 'invite' | 'revoke';

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && roles.includes(value as Role);
}

export function mayManageTeam(role: Role, action: TeamAction): boolean {
  return action === 'read' || role === 'admin';
}

export function normalizeInvitationEmail(value: unknown): string {
  if (typeof value !== 'string') throw new Error('invalid_email');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(email)) throw new Error('invalid_email');
  return email;
}

export function mayRevoke(role: Role, activeAdministrators: number): boolean {
  return role !== 'admin' || activeAdministrators > 1;
}
