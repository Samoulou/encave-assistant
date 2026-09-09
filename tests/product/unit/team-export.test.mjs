import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, renderTeamCsv } from '@encave/domain';
import { TeamExports } from '@encave/tenancy';

test('CSV escapes delimiters, quotes and spreadsheet formulas including whitespace prefixes', () => {
  assert.equal(csvCell('Nom; "cité"'), '"Nom; ""cité"""');
  for (const value of ['=1+1', '+SUM(A1)', '-1+2', '@cell', ' \t=HYPERLINK("x")', '\tname', '\nname']) assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('Cave des Roches'), '"Cave des Roches"');
  const csv = renderTeamCsv('Cave fictive', [{ name: 'Aline; "Test"', email: 'aline@example.test', role: 'reader', revoked: false }]);
  assert.ok(csv.startsWith('\uFEFF"Cave";')); assert.ok(csv.includes('"Lecture";"Actif"\r\n')); assert.ok(csv.includes('"Aline; ""Test"""'));
});

test('export retention accepts bounded server configuration only', () => {
  assert.equal(new TeamExports({}).retentionSeconds, 3600);
  for (const value of [60, 120, 86400]) assert.equal(new TeamExports({}, value).retentionSeconds, value);
  for (const value of [0, 59, 86401, 60.5, NaN]) assert.throws(() => new TeamExports({}, value), /retention/);
});
