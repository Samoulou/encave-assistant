import test from 'node:test';
import assert from 'node:assert/strict';
import { stateGraphs,allowedTransition,foundationTransition } from '../../../packages/domain/src/workflow.ts';
import { inquiryState,proposalState,bookingState,actionState } from '../../../packages/contracts/src/case-core.ts';

test('four independent graphs exactly cover their persisted state vocabulary and reject absent edges',()=>{
  for(const [kind,schema] of Object.entries({inquiry:inquiryState,proposal:proposalState,booking:bookingState,action:actionState})) {
    assert.deepEqual(Object.keys(stateGraphs[kind]).sort(),[...schema.options].sort());
    for(const [from,targets] of Object.entries(stateGraphs[kind])) {
      assert.equal(allowedTransition(kind,from,from),false);
      for(const target of targets) {assert.ok(schema.options.includes(target));assert.equal(allowedTransition(kind,from,target),true);}
    }
    assert.equal(allowedTransition(kind,'invented','invented'),false);
    assert.equal(allowedTransition(kind,'__proto__','constructor'),false);
  }
  assert.equal(allowedTransition('inquiry','received','processed'),false);
  assert.equal(allowedTransition('action','succeeded','planned'),false);
  assert.equal(allowedTransition('booking','cancelled','confirmed'),false);
});

test('commercial and provider state changes remain blocked until their workflow can supply real preconditions',()=>{
  for(const [kind,from,to] of [['proposal','pending_approval','approved'],['proposal','sent','accepted'],['booking','sync_pending','confirmed'],['action','running','succeeded'],['action','uncertain','planned']]) assert.equal(foundationTransition(kind,from,to),false);
  assert.equal(foundationTransition('inquiry','received','qualifying'),true);
  assert.equal(foundationTransition('proposal','draft','pending_approval'),true);
  assert.equal(foundationTransition('action','planned','abandoned'),true);
});
