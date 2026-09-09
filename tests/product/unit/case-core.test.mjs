import test from 'node:test';
import assert from 'node:assert/strict';
import { caseIdentity, inquiryState, proposalState, bookingState, actionState, recordVersion, termsHash } from '../../../packages/contracts/src/case-core.ts';

test('case contracts keep independent state vocabularies and reject unknown authority fields', () => {
  assert.equal(inquiryState.parse('received'), 'received');
  assert.equal(proposalState.parse('accepted'), 'accepted');
  assert.equal(bookingState.parse('sync_pending'), 'sync_pending');
  assert.equal(actionState.parse('uncertain'), 'uncertain');
  assert.equal(inquiryState.safeParse('succeeded').success, false);
  assert.equal(bookingState.safeParse('sent').success, false);
  assert.equal(actionState.safeParse('confirmed').success, false);
  const record = { id:'11111111-1111-4111-8111-111111111111',caveId:'22222222-2222-4222-8222-222222222222',version:1,state:'received' };
  assert.deepEqual(caseIdentity.parse(record), record);
  assert.equal(caseIdentity.safeParse({ ...record, modelTenant:'foreign' }).success, false);
});

test('record versions and term fingerprints reject fractional, empty or out-of-range values', () => {
  for (const value of [0,-1,1.1,2147483648,'1',null]) assert.equal(recordVersion.safeParse(value).success, false);
  assert.equal(termsHash.parse('a'.repeat(64)), 'a'.repeat(64));
  for (const value of ['', 'a'.repeat(63), 'Z'.repeat(64)]) assert.equal(termsHash.safeParse(value).success, false);
});
