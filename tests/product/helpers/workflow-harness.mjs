import { identityHarness,HttpBrowser } from './identity-harness.mjs';
import { seedCaseFixtures } from '../../../packages/tooling/src/case-fixtures.ts';
import { WorkflowStore } from '../../../apps/api/src/workflow-store.ts';

export async function workflowHarness(t) {
  const h=await identityHarness(); t.after(()=>h.stop());
  return {...h,cases:await seedCaseFixtures(h),workflow:new WorkflowStore(h.pool)};
}
export async function loginWorkflow(h,subject='alice') {
  const browser=new HttpBrowser(h.appOrigin);await browser.login(subject);const s=(await browser.session()).body;
  return {browser,context:{token:browser.cookies.get(new URL(h.appOrigin).host).get('encave_session'),csrf:s.csrf,expectedCave:s.activeCave.id}};
}
