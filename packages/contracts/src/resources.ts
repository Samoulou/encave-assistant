import { z } from 'zod';
import { validResourceTimeZone } from '@encave/domain';

const text = (max: number) => z.string().trim().min(1).max(max);
const expectedVersion = z.number().int().min(1).max(2147483647);
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const until = z.string().regex(/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/);
const local = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const offset = z.string().regex(/^[+-]\d{2}:\d{2}$/).nullable();
const slot = z.object({weekday:z.number().int().min(1).max(7),from:clock,to:until}).strict();
export const resourceDefinitionSchema = z.object({
  schemaVersion:z.literal(1),name:text(160),kind:z.enum(['room','team','equipment']),
  timeZone:text(100).refine(validResourceTimeZone,'IANA time zone required'),
  hoursMode:z.enum(['unknown','always','weekly']),weeklyHours:z.array(slot).max(42),
  sourceTruth:z.enum(['unknown','internal_controlled','microsoft_resource','external_uncontrolled']),sourcePolicy:text(2000).nullable(),
}).strict().superRefine((value,context)=>{
  if(value.hoursMode!=='weekly' && value.weeklyHours.length) context.addIssue({code:'custom',message:'Only weekly mode has weekly slots'});
  const ordered=[...value.weeklyHours].sort((a,b)=>a.weekday-b.weekday || a.from.localeCompare(b.from));
  for(let i=0;i<ordered.length;i++) {
    const current=ordered[i]!,previous=ordered[i-1];
    if(current.from>=current.to || (previous?.weekday===current.weekday && previous.to>current.from)) context.addIssue({code:'custom',message:'Inverted or overlapping weekly hours'});
  }
});
export type ResourceDefinition = z.infer<typeof resourceDefinitionSchema>;
export const resourceCreateSchema = z.object({definition:resourceDefinitionSchema}).strict();
export const resourceReviseSchema = z.object({expectedVersion,definition:resourceDefinitionSchema}).strict();
export const resourceEnableSchema = z.object({expectedVersion,enabled:z.boolean()}).strict();
export const resourceClosureSchema = z.object({expectedVersion,startLocal:local,endLocal:local,startOffset:offset,endOffset:offset,reason:text(240)}).strict();
export const resourceClosureCancelSchema = z.object({expectedVersion}).strict();
const rule = z.object({resourceId:z.uuid(),beforeMinutes:z.number().int().min(0).max(1440),afterMinutes:z.number().int().min(0).max(1440)}).strict();
export const resourcePlanSchema = z.object({expectedVersion:z.number().int().min(0).max(2147483647),anchorResourceId:z.uuid(),rules:z.array(rule).min(1).max(20)}).strict().superRefine((value,context)=>{
  const ids=new Set(value.rules.map(item=>item.resourceId));
  if(ids.size!==value.rules.length || !ids.has(value.anchorResourceId)) context.addIssue({code:'custom',message:'Unique resources including the anchor are required'});
});
export const occupationPreviewSchema = z.object({
  expectedPlanVersion:expectedVersion,expectedResources:z.array(z.object({id:z.uuid(),version:expectedVersion}).strict()).min(1).max(20),
  startLocal:local,startOffset:offset,durationMinutes:z.number().int().min(1).max(43200).nullable(),
}).strict().superRefine((value,context)=>{
  if(new Set(value.expectedResources.map(item=>item.id)).size!==value.expectedResources.length) context.addIssue({code:'custom',message:'Duplicate resource versions'});
});
