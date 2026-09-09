import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { catalogHarness,catalogBrowser,approvedOffer,catalogDefinition } from './catalog-harness.mjs';
export {catalogHarness,catalogBrowser,approvedOffer,catalogDefinition};

export const resourceDefinition=(overrides={})=>({schemaVersion:1,name:'Salle fictive de recette',kind:'room',timeZone:'Europe/Zurich',hoursMode:'always',weeklyHours:[],sourceTruth:'internal_controlled',sourcePolicy:'Agenda interne fictif sous contrôle de la cave de test.',...overrides});
export async function resourceCommand(browser,path,body,key=randomUUID(),headers={}) {
  const response=await browser.command(path,body,{'idempotency-key':key,...headers});return {status:response.status,body:await response.json()};
}
export async function resourceRead(browser,path) {
  const session=await browser.session(),response=await browser.request(path,{headers:{'x-encave-cave':session.body.activeCave.id}});return {status:response.status,body:await response.json()};
}
export async function activeResource(browser,definition=resourceDefinition()) {
  const created=await resourceCommand(browser,'/api/resources',{definition});assert.equal(created.status,201);
  const active=await resourceCommand(browser,'/api/resources/'+created.body.id+'/enable',{expectedVersion:1,enabled:true});assert.equal(active.status,200);return active.body;
}
export async function resourceScenario(t,options={}) {
  const h=await catalogHarness(t),browser=await catalogBrowser(h),offer=await approvedOffer(browser,options.offer??catalogDefinition());
  const resource=await activeResource(browser,options.resource??resourceDefinition());
  const plan=await resourceCommand(browser,'/api/catalog/versions/'+offer.versionId+'/resources',{expectedVersion:0,anchorResourceId:resource.id,rules:[{resourceId:resource.id,beforeMinutes:30,afterMinutes:20}]});assert.equal(plan.status,200);
  return {...h,browser,offer,resource,plan:plan.body};
}
export const previewBody=(h,overrides={})=>({expectedPlanVersion:h.plan.version,expectedResources:[{id:h.resource.id,version:h.resource.version}],startLocal:'2026-09-09T10:00',startOffset:null,durationMinutes:null,...overrides});
