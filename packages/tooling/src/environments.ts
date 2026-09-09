import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const names = ['development', 'preproduction', 'production'] as const;
const isolatedFields = ['resource_prefix', 'database_name', 'oidc_realm', 'credential_namespace', 'github_environment'] as const;

export function validateEnvironments(values: unknown[]): void {
  if (values.length !== names.length) throw new Error('Three separate environments are required');
  const seen = new Map(isolatedFields.map(key => [key, new Set<string>()]));
  for (const [index, value] of values.entries()) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid environment');
    const c = value as Record<string, unknown>;
    const name = names[index]!;
    if (c['schema_version'] !== 1 || c['project'] !== 'encave-assistant' || c['environment'] !== name || c['github_environment'] !== name) {
      throw new Error('Environment identity mismatch');
    }
    if (c['region'] !== (name === 'development' ? 'local' : 'westeurope') ||
        c['provisioning_state'] !== (name === 'development' ? 'foundation_only' : 'not_provisioned') ||
        c['external_effects_enabled'] !== false || c['auto_release'] !== false) {
      throw new Error('Only the documented inactive environment plans are permitted');
    }
    const allowed = new Set(['schema_version', 'project', 'environment', 'region', 'provisioning_state', 'external_effects_enabled', 'auto_release', ...isolatedFields]);
    if (Object.keys(c).some(key => !allowed.has(key))) throw new Error('Unexpected environment configuration field');
    for (const field of isolatedFields) {
      const text = c[field];
      const fieldValues = seen.get(field)!;
      if (typeof text !== 'string' || !/^[a-z][a-z0-9_/-]{2,80}$/.test(text) || fieldValues.has(text)) {
        throw new Error(`Environment ${field} must be explicit and distinct`);
      }
      fieldValues.add(text);
    }
  }
}

export async function checkEnvironments(base: string): Promise<void> {
  const values = await Promise.all(names.map(async name => JSON.parse(await readFile(join(base, 'ops/environments', name + '.json'), 'utf8'))));
  validateEnvironments(values);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await checkEnvironments(fileURLToPath(new URL('../../../', import.meta.url)));
    console.log('Environment plans isolated; remote infrastructure and external effects remain inactive');
  } catch (error) {
    console.error('Environment plan validation failed:', error instanceof Error ? error.message : 'invalid configuration');
    process.exitCode = 1;
  }
}
