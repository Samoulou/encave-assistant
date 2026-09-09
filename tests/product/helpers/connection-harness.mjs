import { createServer } from 'node:http';
import { mkdir,mkdtemp,writeFile,rm } from 'node:fs/promises';
import { randomBytes,randomUUID } from 'node:crypto';
import { join,resolve,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureProvider } from '../../../packages/tooling/identity-fixture-provider.mjs';
import { microsoftFixture } from '../../../packages/tooling/microsoft-fixture.mjs';
import { createIdentityTestDatabase } from '../../../packages/tooling/src/identity-test-database.ts';
import { launch,stopProcess,until } from '../../../packages/tooling/src/processes.ts';
import { IdentityStore } from '../../../apps/api/src/identity-store.ts';
import { createIdentityHandler } from '../../../apps/api/src/identity-http.ts';
import { ConnectionStore } from '../../../apps/api/src/connection-store.ts';
import { freePort,HttpBrowser } from './identity-harness.mjs';
export { HttpBrowser };
export const caveA='11111111-1111-4111-8111-111111111111',caveB='22222222-2222-4222-8222-222222222222';
export async function connectionHarness({web=false,compiled=false,configured=true}={}){
 const root=fileURLToPath(new URL('../../../',import.meta.url)),local=resolve(root,'.local'),apiPort=await freePort(),webPort=web?await freePort():apiPort,providerPort=await freePort(),microsoftPort=await freePort();
 const apiOrigin=`http://127.0.0.1:${apiPort}`,appOrigin=`http://127.0.0.1:${webPort}`;
 let provider,microsoft,database,directory,api,webProcess,server;
 const stop=async()=>{if(webProcess)await stopProcess(webProcess);if(api)await stopProcess(api);if(server){server.closeAllConnections();await new Promise(r=>server.close(r));server=null;}if(provider)await provider.stop();if(microsoft)await microsoft.stop();if(database)await database.cleanup();if(directory){const owned=resolve(directory);if(!owned.startsWith(local+sep)||!owned.slice(local.length+1).startsWith('connection-test-'))throw new Error('Invalid owned connection fixture');await rm(owned,{recursive:true,force:true});}};
 try{
  provider=await fixtureProvider(providerPort,appOrigin);microsoft=await microsoftFixture(microsoftPort,appOrigin);database=await createIdentityTestDatabase(provider.issuer);
  const settings={issuer:provider.issuer,clientId:'encave-test',clientSecret:'public-fixture-client-credential',appOrigin,encryptionKey:randomBytes(32).toString('hex'),environment:'test'},options=configured?{microsoft:microsoft.settings}:{};
  const connectionStore=new ConnectionStore(database.pool,appOrigin,'test',configured?microsoft.settings:undefined);
  await mkdir(local,{recursive:true});directory=await mkdtemp(join(local,'connection-test-'));const configFile=join(directory,'runtime.json');await writeFile(configFile,JSON.stringify({database:database.applicationConfig,oidc:settings,...options}),{mode:0o600,flag:'wx'});
  const startApi=async()=>{if(api)await stopProcess(api);if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
   if(compiled){api=launch(process.execPath,['apps/api/dist/index.js'],{cwd:root,env:{...process.env,PORT:String(apiPort),ENCAVE_IDENTITY_CONFIG:configFile}});await until(async()=>{try{return(await fetch(apiOrigin+'/api/session')).status===401;}catch{return false;}},api,15000);return api.child.pid;}
   const handler=createIdentityHandler(new IdentityStore(database.pool),settings,options);server=createServer((q,s)=>void handler(q,s));await new Promise((r,j)=>{server.once('error',j);server.listen(apiPort,'127.0.0.1',r);});return process.pid;
  };
  const firstPid=await startApi();if(web){webProcess=launch(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(webPort)],{cwd:join(root,'apps/web'),env:{...process.env,ENCAVE_API_ORIGIN:apiOrigin,NEXT_TELEMETRY_DISABLED:'1'}});await until(async()=>{try{return(await fetch(appOrigin+'/connexion')).status===200;}catch{return false;}},webProcess,30000);}
  return{...database,appOrigin,apiOrigin,microsoft,connectionStore,firstPid,restartApi:startApi,stop};
 }catch(e){await stop();throw e;}
}
export async function listConnections(browser){const s=await browser.session(),r=await browser.request('/api/connections',{headers:{'x-encave-cave':s.body.activeCave.id}});return{status:r.status,body:await r.json()};}
export async function beginConnection(browser,{id=null,version=0,label='Connexion synthétique'}={},key=randomUUID()){const r=await browser.command('/api/connections/microsoft/start',{provider:'microsoft365',connectionId:id,expectedVersion:version,label},{'idempotency-key':key});return{status:r.status,body:await r.json(),key};}
export async function connectAccount(f,browser,account='a',options={}){const start=await beginConnection(browser,options);if(start.status!==200)throw new Error('Connection start failed: '+start.body.error);const callback=f.microsoft.approve(start.body.url,account),r=await browser.request(callback);if(!r.headers.get('location')?.endsWith('result=connected'))throw new Error('Connection callback failed: '+r.headers.get('location'));return(await listConnections(browser)).body.items.find(x=>x.id===start.body.id);}
export async function operateConnection(browser,row,action,extra={},key=randomUUID()){const r=await browser.command('/api/connections/'+row.id+'/'+action,{expectedVersion:row.version,...extra},{'idempotency-key':key});return{status:r.status,body:await r.json(),key};}
export async function selectConnection(browser,row){const r=await operateConnection(browser,row,'resources',{mailboxId:row.resources.find(x=>x.kind==='mailbox')?.id??null,calendarId:row.resources.find(x=>x.kind==='calendar')?.id??null});if(r.status!==200)throw new Error('Resource selection failed: '+r.body.error);return(await listConnections(browser)).body.items.find(x=>x.id===row.id);}
