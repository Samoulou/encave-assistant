import { createHash,timingSafeEqual } from 'node:crypto';
import { ConfidentialClientApplication,type INetworkModule,type NetworkRequestOptions,type NetworkResponse } from '@azure/msal-node';
import { decodeJwt,createLocalJWKSet,jwtVerify,type JSONWebKeySet } from 'jose';
import { ConnectorError,connectorOperations,type Capability,type ProviderIdentity,type ProviderResource,type ProviderOperations,type ProviderLifecycle,type ProviderDiscovery } from '@encave/contracts';

const login='https://login.microsoftonline.com',graph='https://graph.microsoft.com';
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const text=(v:unknown,max=2048):v is string=>typeof v==='string'&&v.length>0&&v.length<=max;
export const microsoftDiscoveryScopes=Object.freeze(['User.Read','Mail.ReadBasic','Calendars.ReadBasic']);
export type MicrosoftSettings={clientId:string;clientSecret:string;encryptionKey:string;keyVersion:string;fixtureOrigin?:string};
export type MicrosoftCredentials={cache:string;homeAccountId:string;identity:ProviderIdentity;expiresAt:string;scopes:string[]};
export type MicrosoftDiscovery=ProviderDiscovery<MicrosoftCredentials>;
export function validateMicrosoftSettings(s:MicrosoftSettings,environment:string){
 if(!s||!uuid(s.clientId)||!text(s.clientSecret,4096)||!/^[a-f0-9]{64}$/i.test(s.encryptionKey)||!/^[a-zA-Z0-9_-]{1,40}$/.test(s.keyVersion))throw new Error('Invalid Microsoft configuration');
 if(s.fixtureOrigin!==undefined){const u=new URL(s.fixtureOrigin);if(environment!=='test'||u.origin!==s.fixtureOrigin||u.protocol!=='http:'||u.hostname!=='127.0.0.1'||u.username||u.password)throw new Error('Synthetic Microsoft transport is test-only');}
}
export function providerFailure(error:unknown):ConnectorError{
 if(error instanceof ConnectorError)return error;const e=error as {errorCode?:string;subError?:string;errorNo?:unknown;errorCodes?:unknown};
 const codes=[e?.errorNo,...(Array.isArray(e?.errorCodes)?e.errorCodes:[])];
 if(codes.some(code=>code===90094||code===90093||code==='90094'||code==='90093'))return new ConnectorError('admin_consent_required');
 if(['consent_required','interaction_required','invalid_grant','no_tokens_found','token_refresh_required','no_account_in_silent_request'].includes(e?.errorCode??''))return new ConnectorError('interaction_required');
 if(e?.errorCode==='access_denied')return new ConnectorError('consent_denied');
 return new ConnectorError('provider_unavailable');
}
class MicrosoftNetwork implements INetworkModule {
 readonly fixtureOrigin:string|undefined;readonly guard:(()=>Promise<void>)|undefined;
 constructor(fixtureOrigin?:string,guard?:()=>Promise<void>){this.fixtureOrigin=fixtureOrigin;this.guard=guard;}
 async request<T>(url:string,options:NetworkRequestOptions={},method='GET'):Promise<NetworkResponse<T>>{
  const u=new URL(url);if(![login,graph].includes(u.origin)||u.username||u.password||u.hash)throw new ConnectorError('invalid_provider_response');
  await this.guard?.();
  const target=this.fixtureOrigin?this.fixtureOrigin+(u.origin===login?'/identity':'/graph')+u.pathname+u.search:u.href;
  try{const r=await fetch(target,{method,headers:options.headers??{},...(method==='POST'&&options.body!==undefined?{body:options.body}:{}),redirect:'error',signal:AbortSignal.timeout(5000)}),reader=r.body?.getReader();let size=0;const chunks:Uint8Array[]=[];if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1_048_576){await reader.cancel();throw new ConnectorError('invalid_provider_response');}chunks.push(value);}}
   const body=JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;return{body,status:r.status,headers:Object.fromEntries(r.headers)};
  }catch(error){if(error instanceof ConnectorError)throw error;throw new ConnectorError('provider_unavailable');}
 }
 sendGetRequestAsync<T>(url:string,options?:NetworkRequestOptions){return this.request<T>(url,options);}
 sendPostRequestAsync<T>(url:string,options?:NetworkRequestOptions){return this.request<T>(url,options,'POST');}
}
export class MicrosoftAdapter implements ProviderOperations,ProviderLifecycle<MicrosoftCredentials> {
 readonly settings:MicrosoftSettings;readonly redirectUri:string;readonly synthetic:boolean;readonly network:MicrosoftNetwork;
 constructor(settings:MicrosoftSettings,appOrigin:string,environment:string,guard?:()=>Promise<void>){validateMicrosoftSettings(settings,environment);this.settings=settings;this.redirectUri=appOrigin+'/api/connections/microsoft/callback';this.synthetic=Boolean(settings.fixtureOrigin);this.network=new MicrosoftNetwork(settings.fixtureOrigin,guard);}
 private client(tenant='organizations'){return new ConfidentialClientApplication({auth:{clientId:this.settings.clientId,clientSecret:this.settings.clientSecret,authority:login+'/'+tenant},system:{networkClient:this.network,disableInternalRetries:true,loggerOptions:{piiLoggingEnabled:false,loggerCallback:()=>{}}}});}
 async authorization(flow:{state:string;verifier:string;nonce:string}){
  try{const value=await this.client().getAuthCodeUrl({scopes:[...microsoftDiscoveryScopes,'offline_access','openid','profile'],redirectUri:this.redirectUri,state:flow.state,nonce:flow.nonce,codeChallenge:createHash('sha256').update(flow.verifier).digest('base64url'),codeChallengeMethod:'S256',prompt:'select_account',responseMode:'query'});const u=new URL(value);if(u.origin!==login)throw new ConnectorError('oauth_invalid');return this.settings.fixtureOrigin?this.settings.fixtureOrigin+'/identity'+u.pathname+u.search:u.href;}catch(e){throw providerFailure(e);}
 }
 private async identity(idToken:string,nonce:string){
  try{const decoded=decodeJwt(idToken),tid=decoded.tid;if(!uuid(tid)||tid==='9188040d-6c67-4c5b-b112-36a304b66dad')throw new ConnectorError('identity_mismatch');const issuer=login+'/'+tid+'/v2.0';
   const keys=await this.network.request<JSONWebKeySet>(login+'/'+tid+'/discovery/v2.0/keys');if(keys.status!==200||!Array.isArray(keys.body.keys)||keys.body.keys.length>100)throw new ConnectorError('invalid_provider_response');
   const allowed=keys.body.keys.filter(k=>typeof (k as any).issuer!=='string'||(k as any).issuer.replace('{tenantid}',tid)===issuer);const {payload}=await jwtVerify(idToken,createLocalJWKSet({keys:allowed}),{algorithms:['RS256'],audience:this.settings.clientId,issuer,clockTolerance:5,maxTokenAge:'10m',requiredClaims:['iss','aud','exp','iat','sub','tid','oid','nonce','ver']});
   if(!uuid(payload.oid)||typeof payload.sub!=='string'||payload.ver!=='2.0'||typeof payload.nonce!=='string'||payload.nonce.length!==nonce.length||!timingSafeEqual(Buffer.from(payload.nonce),Buffer.from(nonce)))throw new ConnectorError('identity_mismatch');
   return{tenantId:tid,accountId:payload.oid,displayName:typeof payload.name==='string'?payload.name.slice(0,160):'Compte Microsoft',username:typeof payload.preferred_username==='string'?payload.preferred_username.slice(0,254):''};
  }catch(error){if(error instanceof ConnectorError)throw error;throw new ConnectorError('oauth_invalid');}
 }
 async complete(code:string,flow:{verifier:string;nonce:string}):Promise<MicrosoftDiscovery>{
  try{const client=this.client(),result=await client.acquireTokenByCode({code,codeVerifier:flow.verifier,redirectUri:this.redirectUri,scopes:[...microsoftDiscoveryScopes]});if(!result?.account||!result.idToken||!result.accessToken||!result.expiresOn)throw new ConnectorError('oauth_invalid');
   const identity=await this.identity(result.idToken,flow.nonce);if(result.account.tenantId!==identity.tenantId||result.account.localAccountId!==identity.accountId)throw new ConnectorError('identity_mismatch');
   const credentials:MicrosoftCredentials={cache:client.getTokenCache().serialize(),homeAccountId:result.account.homeAccountId,identity,expiresAt:result.expiresOn.toISOString(),scopes:result.scopes};return await this.resources(result.accessToken,credentials);
  }catch(e){throw providerFailure(e);}
 }
 async inspect(credentials:MicrosoftCredentials):Promise<MicrosoftDiscovery>{
  try{const client=this.client(credentials.identity.tenantId);client.getTokenCache().deserialize(credentials.cache);const account=await client.getTokenCache().getAccountByHomeId(credentials.homeAccountId);if(!account||account.tenantId!==credentials.identity.tenantId||account.localAccountId!==credentials.identity.accountId)throw new ConnectorError('identity_mismatch');
   const result=await client.acquireTokenSilent({account,scopes:[...microsoftDiscoveryScopes]});if(!result?.accessToken||!result.expiresOn||result.account?.homeAccountId!==credentials.homeAccountId)throw new ConnectorError('interaction_required');return await this.resources(result.accessToken,{...credentials,cache:client.getTokenCache().serialize(),expiresAt:result.expiresOn.toISOString(),scopes:result.scopes});
  }catch(e){throw providerFailure(e);}
 }
 private async graph(path:string,token:string){const r=await this.network.request<Record<string,unknown>>(graph+'/v1.0'+path,{headers:{Authorization:'Bearer '+token}});if(r.status===429)throw new ConnectorError('rate_limited',Math.min(3600,Math.max(1,Number(r.headers['retry-after'])||60)));if(r.status===401)throw new ConnectorError('interaction_required');if(r.status===403)throw new ConnectorError('permission_missing');if(r.status===404)throw new ConnectorError('resource_missing');if(r.status!==200||!r.body||Array.isArray(r.body))throw new ConnectorError('provider_unavailable');return r.body;}
 private async resources(token:string,credentials:MicrosoftCredentials):Promise<MicrosoftDiscovery>{
  const me=await this.graph('/me?$select=id,displayName,userPrincipalName',token);if(me.id!==credentials.identity.accountId)throw new ConnectorError('identity_mismatch');const resources:ProviderResource[]=[],missing:string[]=[];
  for(const kind of ['mailbox','calendar'] as const){try{const data=await this.graph(kind==='mailbox'?'/me/mailFolders/inbox?$select=id,displayName':'/me/calendar?$select=id,name,canEdit',token);if(!text(data.id)||!text(kind==='mailbox'?data.displayName:data.name,160))throw new ConnectorError('invalid_provider_response');resources.push({kind,id:kind==='mailbox'?credentials.identity.accountId:data.id,name:kind==='mailbox'?'Boîte de '+credentials.identity.displayName:String(data.name),ownerId:credentials.identity.accountId,writable:false});}
   catch(e){if(e instanceof ConnectorError&&['permission_missing','resource_missing'].includes(e.code))missing.push(kind);else throw e;}}
  return{credentials,resources,missing};
 }
 capabilities(active:boolean,resources:ProviderResource[]):Capability[]{return connectorOperations.map(operation=>({operation,state:operation!=='discoverResources'?'unavailable':!resources.length?'unavailable':active&&this.synthetic?'available':'unverified',reason:operation!=='discoverResources'?'not_supported':!resources.length?'resource_missing':active&&this.synthetic?'supported':'qualification_required',evidence:active&&this.synthetic?'synthetic':'none'}));}
 async readMessages():Promise<never>{throw new ConnectorError('not_supported');}
 async syncMessages():Promise<never>{throw new ConnectorError('not_supported');}
 async getBusyIntervals():Promise<never>{throw new ConnectorError('not_supported');}
 async createCalendarEvent():Promise<never>{throw new ConnectorError('not_supported');}
 async findCalendarEvent():Promise<never>{throw new ConnectorError('not_supported');}
 async sendMessage():Promise<never>{throw new ConnectorError('not_supported');}
 async reconcileMessage():Promise<never>{throw new ConnectorError('not_supported');}
 async renewSubscription():Promise<never>{throw new ConnectorError('not_supported');}
}
