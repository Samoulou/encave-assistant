import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { identityHarness,HttpBrowser } from './identity-harness.mjs';

export function catalogDefinition(overrides={},now=Date.now()) {
  return {schemaVersion:1,title:'Dégustation fictive — recette',category:'activity_fixed',minimumParticipants:2,maximumParticipants:18,
    durationMode:'fixed',durationMinutes:90,amountMinor:3950,currency:'CHF',priceUnit:'per_person',taxMode:'included',taxRateBasisPoints:700,
    taxLabel:'Taxe de recette fictive incluse : 7 %',conditions:'Conditions fictives de démonstration uniquement.',
    source:{label:'Fiche synthétique approuvée pour le test',reference:'fixture:catalog-v1',verifiedAt:new Date(now-86400000).toISOString(),validUntil:new Date(now+365*86400000).toISOString()},officialUrl:null,...overrides};
}
export async function catalogHarness(t) {const h=await identityHarness();t.after(()=>h.stop());return h;}
export async function catalogBrowser(h,subject='alice') {const browser=new HttpBrowser(h.appOrigin);await browser.login(subject);return browser;}
export async function catalogCommand(browser,path,body,key=randomUUID(),headers={}) {
  const response=await browser.command('/api/catalog/offers'+path,body,{'idempotency-key':key,...headers});
  return {status:response.status,body:await response.json()};
}
export async function catalogRead(browser,path='') {
  const session=await browser.session();const response=await browser.request('/api/catalog/offers'+path,{headers:{'x-encave-cave':session.body.activeCave.id}});
  return {status:response.status,body:await response.json()};
}
export async function approvedOffer(browser,data=catalogDefinition(),enabled=true) {
  const created=await catalogCommand(browser,'',{definition:data});assert.equal(created.status,201);
  const published=await catalogCommand(browser,'/'+created.body.id+'/publish',{versionId:created.body.versionId,expectedVersion:1});assert.equal(published.status,200);
  let result=published.body;
  if(enabled){const active=await catalogCommand(browser,'/'+result.id+'/enable',{enabled:true,expectedVersion:result.version});assert.equal(active.status,200);result=active.body;}
  return {...result,versionId:created.body.versionId};
}
