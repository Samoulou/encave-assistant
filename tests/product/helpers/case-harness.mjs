import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join,resolve,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureProvider } from '../../../packages/tooling/identity-fixture-provider.mjs';
import { createIdentityTestDatabase } from '../../../packages/tooling/src/identity-test-database.ts';
import { launch,stopProcess,until } from '../../../packages/tooling/src/processes.ts';
import { freePort } from './identity-harness.mjs';

export async function caseHarness() {
  const root=fileURLToPath(new URL('../../../',import.meta.url)), local=resolve(root,'.local');
  const apiPort=await freePort(),webPort=await freePort(),providerPort=await freePort();
  const apiOrigin=`http://127.0.0.1:${apiPort}`, appOrigin=`http://127.0.0.1:${webPort}`;
  let provider,database,directory,api,web;
  const stop=async()=>{
    if(web) await stopProcess(web); if(api) await stopProcess(api);
    if(provider) await provider.stop(); if(database) await database.cleanup();
    if(directory){ const owned=resolve(directory); if(!owned.startsWith(local+sep)||!owned.slice(local.length+1).startsWith('case-test-')) throw new Error('Invalid owned fixture directory'); await rm(owned,{recursive:true,force:true}); }
  };
  try {
    provider=await fixtureProvider(providerPort,appOrigin); database=await createIdentityTestDatabase(provider.issuer);
    await mkdir(local,{recursive:true}); directory=await mkdtemp(join(local,'case-test-')); const configFile=join(directory,'runtime.json');
    await writeFile(configFile,JSON.stringify({database:database.applicationConfig,oidc:{issuer:provider.issuer,clientId:'encave-test',clientSecret:'public-fixture-client-credential',appOrigin,encryptionKey:randomBytes(32).toString('hex'),environment:'test'}}),{mode:0o600,flag:'wx'});
    const startApi=async()=>{
      if(api) await stopProcess(api);
      api=launch(process.execPath,['apps/api/dist/index.js'],{cwd:root,env:{...process.env,PORT:String(apiPort),ENCAVE_IDENTITY_CONFIG:configFile}});
      await until(async()=>{try{return (await fetch(apiOrigin+'/api/session')).status===401;}catch{return false;}},api,15000);
      return api.child.pid;
    };
    const firstPid=await startApi();
    web=launch(process.execPath,[join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(webPort)],{cwd:join(root,'apps/web'),env:{...process.env,ENCAVE_API_ORIGIN:apiOrigin,NEXT_TELEMETRY_DISABLED:'1'}});
    await until(async()=>{try{return(await fetch(appOrigin+'/connexion')).status===200;}catch{return false;}},web,30000);
    return {...database,appOrigin,apiOrigin,firstPid,restartApi:startApi,stop};
  } catch(error){await stop();throw error;}
}
