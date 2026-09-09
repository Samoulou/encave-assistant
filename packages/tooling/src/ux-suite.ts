import { fileURLToPath } from 'node:url';
import { runNodeSuite } from './suites.ts';
try { await runNodeSuite(fileURLToPath(new URL('../../../tests/product/ux', import.meta.url))); }
catch { console.error('UX suite failed, absent, empty, skipped or incomplete.'); process.exitCode = 1; }
