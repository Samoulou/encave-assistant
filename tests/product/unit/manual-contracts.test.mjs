import test from 'node:test';
import assert from 'node:assert/strict';
import { manualInquirySchema,requestedDateSchema,inquiryListSchema } from '../../../packages/contracts/src/manual-inquiries.ts';
const valid={contactName:'Nom fictif',contactEmail:null,contactPhone:'+41 21 555 01 02',subject:'Besoin fictif',note:'Compte rendu fictif',origin:'phone',requestedDate:null,participants:null,budgetMinor:null,budgetBasis:null};
test('manual input preserves unknown facts and explicit budget basis while refusing authority and malformed contact fields',()=>{
  assert.equal(manualInquirySchema.parse(valid).budgetMinor,null);assert.equal(manualInquirySchema.parse({...valid,budgetMinor:0,budgetBasis:'group'}).budgetMinor,0);
  for(const patch of [{contactName:' '},{contactEmail:null,contactPhone:null},{contactPhone:'abc123456'},{contactPhone:'12345'},{contactEmail:'bad'},{origin:'email'},{participants:0},{participants:1.5},{budgetMinor:10},{budgetBasis:'person'},{budgetMinor:-1,budgetBasis:'group'},{budgetMinor:1.2,budgetBasis:'group'},{actorId:'forged'},{caveId:'forged'},{state:'processed'},{note:'x'.repeat(4001)}])assert.equal(manualInquirySchema.safeParse({...valid,...patch}).success,false);
});
test('date-only facts reject impossible days and bounded queue queries are closed',()=>{
  assert.equal(requestedDateSchema.safeParse('2028-02-29').success,true);
  for(const d of ['2026-02-29','2026-04-31','2026-01-01T00:00Z','1899-12-31'])assert.equal(requestedDateSchema.safeParse(d).success,false);
  assert.deepEqual(inquiryListSchema.parse({}),{q:'',filter:'to_process',sort:'priority',page:1});
  for(const q of [{page:0},{page:1.2},{filter:'sent'},{sort:'random'},{q:'x'.repeat(121)},{cave:'foreign'}])assert.equal(inquiryListSchema.safeParse(q).success,false);
});
