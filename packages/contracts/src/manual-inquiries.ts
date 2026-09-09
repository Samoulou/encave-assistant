import { z } from 'zod';

export const manualFieldMessages: Record<string,string> = {
  contactName:'Indiquez un nom (160 caractères maximum).', contactEmail:'Saisissez une adresse e-mail valide.',
  contactPhone:'Saisissez un téléphone valide (6 à 20 chiffres).', subject:'Décrivez le besoin en 240 caractères maximum.',
  note:'Ajoutez le compte rendu (4 000 caractères maximum).', origin:'Choisissez l’origine de la saisie.',
  requestedDate:'Saisissez une date valide au format AAAA-MM-JJ.', participants:'Indiquez un nombre entier de 1 à 100 000 personnes.',
  budgetMinor:'Indiquez un budget CHF positif ou nul, avec deux décimales maximum.', budgetBasis:'Précisez si le budget concerne le groupe ou une personne.',
};
const text=(n:number)=>z.string().trim().min(1).max(n);
export const requestedDateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{
  const d=new Date(s+'T00:00:00Z');return s>='1900-01-01'&&s<='9999-12-31'&&Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;
});
export const manualInquirySchema=z.object({
  contactName:text(160),contactEmail:z.email().max(254).nullable(),
  contactPhone:z.string().trim().regex(/^\+?[0-9 ()\-.]+$/).max(40).refine(s=>{const n=s.replace(/\D/g,'').length;return n>=6&&n<=20;}).nullable(),
  subject:text(240),note:text(4000),origin:z.enum(['phone','in_person','other']),requestedDate:requestedDateSchema.nullable(),
  participants:z.number().int().min(1).max(100000).nullable(),budgetMinor:z.number().int().min(0).max(1000000000).nullable(),
  budgetBasis:z.enum(['group','person']).nullable(),
}).strict().superRefine((v,c)=>{
  if(v.contactEmail===null&&v.contactPhone===null)c.addIssue({code:'custom',path:['contactEmail'],message:'Indiquez au moins un e-mail ou un téléphone pour répondre.'});
  if((v.budgetMinor===null)!==(v.budgetBasis===null))c.addIssue({code:'custom',path:[v.budgetMinor===null?'budgetMinor':'budgetBasis'],message:'Budget et base doivent être précisés ensemble.'});
});
export type ManualInquiryInput=z.infer<typeof manualInquirySchema>;
export const inquiryListSchema=z.object({q:z.string().trim().max(120).default(''),filter:z.enum(['all','to_process','waiting','reserve','recovery','booked','archived']).default('to_process'),sort:z.enum(['priority','oldest','newest']).default('priority'),page:z.coerce.number().int().min(1).max(20000).default(1)}).strict();
