import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogDefinitionSchema } from '../../../packages/contracts/src/catalog.ts';
import { catalogBlockers } from '../../../packages/domain/src/catalog.ts';
import { catalogDefinition } from '../helpers/catalog-harness.mjs';

const now=Date.parse('2030-01-01T00:00:00.000Z');
test('catalog schema keeps explicit CHF units, missing values and zero distinct and rejects inconsistent or unbounded data',()=>{
  const data=catalogDefinition({},now);assert.deepEqual(catalogDefinitionSchema.parse(data),data);
  assert.equal(catalogDefinitionSchema.parse({...data,amountMinor:0}).amountMinor,0);
  assert.equal(catalogDefinitionSchema.parse({...data,amountMinor:null}).amountMinor,null);
  for(const change of [{currency:'EUR'},{amountMinor:39.5},{amountMinor:-1},{amountMinor:1000000001},{minimumParticipants:20,maximumParticipants:10},
    {durationMinutes:0},{durationMinutes:43201},{category:'room_quote'},{durationMode:'variable'},
    {taxMode:'unknown'},{taxMode:'not_applicable',taxRateBasisPoints:700},{taxRateBasisPoints:10001},
    {officialUrl:'javascript:alert(1)'},{officialUrl:'https://user:password@fixture.example'},{approvedBy:'forged'},{source:{...data.source,validUntil:data.source.verifiedAt}}]) {
    assert.equal(catalogDefinitionSchema.safeParse({...data,...change}).success,false);
  }
});

test('automatic catalog eligibility blocks every unknown or manual prerequisite while a known free price is eligible',()=>{
  const data=catalogDefinition({},now);assert.deepEqual(catalogBlockers(data,true,now),[]);
  assert.deepEqual(catalogBlockers({...data,amountMinor:0},true,now),[]);
  assert.deepEqual(catalogBlockers(null,false,now),['offer_disabled','offer_unpublished']);
  for(const [change,reason] of [[{amountMinor:null},'price_missing'],[{minimumParticipants:null},'capacity_unknown'],[{maximumParticipants:null},'capacity_unknown'],
    [{durationMinutes:null},'duration_unknown'],[{durationMode:'unknown',durationMinutes:null},'duration_unknown'],[{taxRateBasisPoints:null},'tax_rule_unknown'],
    [{taxMode:'unknown',taxRateBasisPoints:null,taxLabel:null},'tax_rule_unknown'],[{conditions:null},'conditions_missing'],[{source:null},'source_missing'],
    [{category:'room_quote'},'manual_offer_required'],[{category:'event_info'},'manual_offer_required']]) assert.ok(catalogBlockers({...data,...change},true,now).includes(reason));
  assert.deepEqual(catalogBlockers(data,false,now),['offer_disabled']);
});

test('source freshness uses explicit instants and refuses missing, future, expired or malformed evidence',()=>{
  const data=catalogDefinition({},now);
  for(const source of [{...data.source,verifiedAt:new Date(now+1).toISOString()},{...data.source,validUntil:new Date(now).toISOString()},
    {...data.source,verifiedAt:'unknown'},{...data.source,validUntil:'invalid'}]) assert.ok(catalogBlockers({...data,source},true,now).includes('source_not_current'));
  assert.ok(catalogBlockers(data,true,NaN).includes('source_not_current'));
});
