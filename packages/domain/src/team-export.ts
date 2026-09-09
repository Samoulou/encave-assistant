export type ExportMember = { name: string; email: string; role: string; revoked: boolean };

export function csvCell(value: string): string {
  // Guard spreadsheet formulas even after leading whitespace/control characters.
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function renderTeamCsv(caveName: string, members: readonly ExportMember[]): string {
  const roles: Record<string, string> = { admin: 'Administrateur', operator: 'Opérateur', reader: 'Lecture' };
  const rows = [['Cave', 'Nom', 'Adresse e-mail', 'Rôle', 'Accès'], ...members.map(member => [caveName, member.name, member.email, roles[member.role] ?? member.role, member.revoked ? 'Révoqué' : 'Actif'])];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
