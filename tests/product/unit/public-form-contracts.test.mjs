import test from 'node:test';
import assert from 'node:assert/strict';
import { publicInquirySchema,publicFormDefinitionSchema,publicSubmissionSchema } from '@encave/contracts';
import { publicInput,formDefinition } from '../helpers/public-form-harness.mjs';
test('public form requires a usable response channel, bounded facts and no visitor authority',()=>{
  assert.ok(publicInquirySchema.safeParse(publicInput()).success);assert.ok(publicInquirySchema.safeParse(publicInput({contactEmail:null,contactPhone:'+41 21 555 01 02'})).success);
  for(const override of [{contactEmail:null},{contactEmail:'bad'},{contactPhone:'123'},{need:''},{need:'a'.repeat(4001)},{contactName:'x'.repeat(161)},{requestedDate:'2026-02-30'},{participants:0},{participants:1.5},{budgetMinor:100},{budgetMinor:100,budgetBasis:'unknown'},{caveId:'foreign'},{createdBy:'alice'},{state:'booked'}])assert.equal(publicInquirySchema.safeParse(publicInput(override)).success,false);
  assert.ok(publicInquirySchema.safeParse(publicInput({budgetMinor:0,budgetBasis:'group',participants:12,requestedDate:'2028-02-29'})).success);
});
test('anti-spam settings cannot be disabled or made unbounded and submission envelope is closed',()=>{
  assert.ok(publicFormDefinitionSchema.safeParse(formDefinition()).success);for(const patch of [{minimumDelayMs:0},{challengeTtlSeconds:0},{attemptLimitPerMinute:0},{attemptLimitPerHour:1001},{challengeLimitPerMinute:121},{intro:'x'.repeat(1001)},{extra:true}])assert.equal(publicFormDefinitionSchema.safeParse(formDefinition(patch)).success,false);
  assert.equal(publicSubmissionSchema.safeParse({inquiry:publicInput(),challenge:'bad',requestKey:'bad',website:''}).success,false);
});
