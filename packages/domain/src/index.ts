/** Technical scope only. No business action exists in DEV-01. */
export const foundationScope = Object.freeze({
  product: 'EnCave Assistant',
  mode: 'foundation',
  synthetic: true,
} as const);
export { roles, isRole, mayManageTeam, normalizeInvitationEmail, mayRevoke, type Role, type TeamAction } from './identity.ts';
