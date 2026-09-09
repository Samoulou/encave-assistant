import { z } from 'zod';
import { requestedDateSchema } from './manual-inquiries.ts';
export const publicFormDefinitionSchema=z.object({intro:z.string().trim().min(1).max(1000),challengeLimitPerMinute:z.number().int().min(1).max(120),attemptLimitPerMinute:z.number().int().min(1).max(60),attemptLimitPerHour:z.number().int().min(1).max(1000),minimumDelayMs:z.number().int().min(500).max(10000),challengeTtlSeconds:z.number().int().min(60).max(3600)}).strict();
export const configurePublicFormSchema=z.object({expectedVersion:z.number().int().min(0).max(10000),enabled:z.boolean(),definition:publicFormDefinitionSchema}).strict();
export const publicInquirySchema=z.object({contactName:z.string().trim().min(1).max(160),contactEmail:z.email().max(254).nullable(),contactPhone:z.string().trim().max(40).regex(/^\+?[0-9 ()\-.]+$/).refine(s=>{const n=s.replace(/\D/g,'').length;return n>=6&&n<=20;}).nullable(),need:z.string().trim().min(1).max(4000),requestedDate:requestedDateSchema.nullable(),participants:z.number().int().min(1).max(100000).nullable(),budgetMinor:z.number().int().min(0).max(1000000000).nullable(),budgetBasis:z.enum(['group','person']).nullable()}).strict().superRefine((v,c)=>{
  if(!v.contactEmail&&!v.contactPhone)c.addIssue({code:'custom',path:['contactEmail'],message:'Un moyen de réponse est nécessaire.'});
  if((v.budgetMinor===null)!==(v.budgetBasis===null))c.addIssue({code:'custom',path:[v.budgetMinor===null?'budgetMinor':'budgetBasis'],message:'Budget et base doivent être précisés ensemble.'});
});
export const publicSubmissionSchema=z.object({challenge:z.string().regex(/^[A-Za-z0-9_-]{43}$/),requestKey:z.uuid(),website:z.string().max(500),inquiry:publicInquirySchema}).strict();
export type PublicFormDefinition=z.infer<typeof publicFormDefinitionSchema>;
