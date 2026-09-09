import { z } from 'zod';
export const connectorOperations=['discoverResources','readMessages','syncMessages','getBusyIntervals','createCalendarEvent','findCalendarEvent','sendMessage','reconcileMessage','renewSubscription'] as const;
export type ConnectorOperation=typeof connectorOperations[number];
export type Capability={operation:ConnectorOperation;state:'available'|'unavailable'|'unverified';reason:'supported'|'not_supported'|'missing_permission'|'qualification_required'|'revoked'|'resource_missing';evidence:'synthetic'|'none'|'authorized_integration'};
export type ProviderResource={kind:'mailbox'|'calendar';id:string;name:string;ownerId:string;writable:boolean};
export type ProviderIdentity={tenantId:string;accountId:string;displayName:string;username:string};
export type ProviderPage<T>={items:T[];nextCursor:string|null;complete:boolean;observedAt:string};
export type ProviderMessage={id:string;threadId:string|null;internetMessageId:string|null;receivedAt:string;sender:{address:string;name:string|null};subject:string;body:string;automatic:boolean};
export type ProviderBusy={id:string;start:string;end:string;cancelled:boolean;recurrenceReference:string|null};
export type ExternalResult={state:'accepted'|'confirmed'|'uncertain';reference:string|null;deliveryProven:boolean};
export type AuthorizedConnection={caveId:string;connectionId:string;authorizationVersion:number;correlationId:string};
export type ProviderHealth={state:'available'|'unavailable'|'unverified';checkedAt:string|null;lastSuccessAt:string|null;expiresAt:string|null;lastSynchronizationAt:string|null;error:ConnectorErrorCode|null;capabilities:Capability[]};
export type ProviderConnectionFlow={state:string;verifier:string;nonce:string};
export type ProviderDiscovery<Credentials>={credentials:Credentials;resources:ProviderResource[];missing:string[]};
// Credentials are resolved by a server-only implementation; no browser or job
// contract transports this generic server value.
export interface ProviderLifecycle<Credentials> {
 authorization(flow:ProviderConnectionFlow):Promise<string>;
 complete(code:string,flow:Pick<ProviderConnectionFlow,'verifier'|'nonce'>):Promise<ProviderDiscovery<Credentials>>;
 inspect(credentials:Credentials):Promise<ProviderDiscovery<Credentials>>;
 capabilities(active:boolean,resources:ProviderResource[]):Capability[];
}
export interface ProviderOperations {
 readMessages(context:AuthorizedConnection,mailboxId:string,cursor:string|null):Promise<ProviderPage<ProviderMessage>>;
 syncMessages(context:AuthorizedConnection,mailboxId:string,cursor:string|null):Promise<ProviderPage<ProviderMessage>>;
 getBusyIntervals(context:AuthorizedConnection,calendarId:string,interval:{start:string;end:string},cursor:string|null):Promise<ProviderPage<ProviderBusy>>;
 createCalendarEvent(context:AuthorizedConnection,action:{stableReference:string;calendarId:string;start:string;end:string;title:string}):Promise<ExternalResult>;
 findCalendarEvent(context:AuthorizedConnection,calendarId:string,stableReference:string):Promise<ExternalResult>;
 sendMessage(context:AuthorizedConnection,action:{stableReference:string;mailboxId:string;to:string[];subject:string;body:string}):Promise<ExternalResult>;
 reconcileMessage(context:AuthorizedConnection,mailboxId:string,stableReference:string):Promise<ExternalResult>;
 renewSubscription(context:AuthorizedConnection,resourceId:string,subscriptionReference:string):Promise<{reference:string;expiresAt:string}>;
}
export type ConnectorErrorCode='not_configured'|'not_supported'|'not_qualified'|'permission_missing'|'consent_denied'|'admin_consent_required'|'interaction_required'|'identity_mismatch'|'provider_unavailable'|'rate_limited'|'invalid_provider_response'|'oauth_invalid'|'resource_missing';
export class ConnectorError extends Error {
 readonly code:ConnectorErrorCode;readonly retryAfter:number|null;
 constructor(code:ConnectorErrorCode,retryAfter:number|null=null){super(code);this.code=code;this.retryAfter=retryAfter;}
}
export const beginConnectionSchema=z.object({provider:z.literal('microsoft365'),connectionId:z.uuid().nullable(),expectedVersion:z.number().int().min(0).max(100000),label:z.string().trim().min(1).max(160)}).strict();
export const connectionVersionSchema=z.object({expectedVersion:z.number().int().min(1).max(100000)}).strict();
export const selectConnectionResourcesSchema=z.object({expectedVersion:z.number().int().min(1).max(100000),mailboxId:z.string().min(1).max(2048).nullable(),calendarId:z.string().min(1).max(2048).nullable()}).strict().refine(v=>v.mailboxId!==null||v.calendarId!==null);
