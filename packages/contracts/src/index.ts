import { z } from 'zod';
export * from './case-core.ts';
export * from './catalog.ts';
export * from './resources.ts';

export const technicalHealthSchema = z.object({
  service: z.enum(['api', 'worker']),
  status: z.literal('ready'),
  mode: z.literal('foundation'),
  synthetic: z.literal(true),
  runId: z.string().min(1),
}).strict();

export type TechnicalHealth = z.infer<typeof technicalHealthSchema>;
