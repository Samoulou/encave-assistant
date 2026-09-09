import test from 'node:test';
import assert from 'node:assert/strict';
import { resourceDefinitionSchema,resourcePlanSchema,occupationPreviewSchema } from '../../../packages/contracts/src/resources.ts';
import { resourceDefinition } from '../helpers/resource-harness.mjs';

test('resource contracts reject contradictory hours, unknown authority fields and invalid plan bounds',()=>{
  const valid=resourceDefinition();assert.deepEqual(resourceDefinitionSchema.parse(valid),valid);
  for(const change of [{timeZone:'+01:00'},{timeZone:'Mars/Olympus'},{enabled:true},{sourceTruth:'connected'},
    {weeklyHours:[{weekday:3,from:'09:00',to:'17:00'}]},
    {hoursMode:'weekly',weeklyHours:[{weekday:3,from:'17:00',to:'09:00'}]},
    {hoursMode:'weekly',weeklyHours:[{weekday:3,from:'09:00',to:'12:00'},{weekday:3,from:'11:00',to:'17:00'}]},
    {hoursMode:'weekly',weeklyHours:[{weekday:8,from:'09:00',to:'17:00'}]}])assert.equal(resourceDefinitionSchema.safeParse({...valid,...change}).success,false);
  assert.ok(resourceDefinitionSchema.safeParse({...valid,hoursMode:'weekly',weeklyHours:[{weekday:3,from:'09:00',to:'12:00'},{weekday:3,from:'12:00',to:'17:00'}]}).success);
  const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',rule={resourceId:id,beforeMinutes:0,afterMinutes:1440};
  const plan={expectedVersion:0,anchorResourceId:id,rules:[rule]};assert.ok(resourcePlanSchema.safeParse(plan).success);
  for(const change of [{anchorResourceId:other},{rules:[rule,rule]},{rules:[]},{rules:[{...rule,beforeMinutes:-1}]},{rules:[{...rule,afterMinutes:1441}]},{rules:[{...rule,beforeMinutes:1.5}]}])assert.equal(resourcePlanSchema.safeParse({...plan,...change}).success,false);
  assert.equal(occupationPreviewSchema.safeParse({expectedPlanVersion:1,expectedResources:[{id,version:1},{id,version:1}],startLocal:'2026-09-09T10:00',startOffset:null,durationMinutes:null}).success,false);
});
