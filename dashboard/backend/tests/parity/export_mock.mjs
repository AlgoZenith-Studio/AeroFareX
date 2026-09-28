/**
 * Export the dashboard mock API's responses (and the landing fare-search mock) to JSON,
 * by running the TypeScript itself. tests/test_parity.py compares the FastAPI backend
 * against this file, so "the backend matches the mock" is checked, not assumed.
 *
 *   node dashboard/backend/tests/parity/export_mock.mjs
 *
 * Regenerate whenever seed.ts, handlers.ts or fares.ts changes, and commit the result.
 */
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../../..');
const require = createRequire(join(repo, 'package.json'));
const ts = require('typescript');

const out = mkdtempSync(join(tmpdir(), 'afx-mock-'));
const transpile = (src, dest) => {
  const code = readFileSync(join(repo, src), 'utf8');
  const js = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
  }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'");
  mkdirSync(dirname(join(out, dest)), { recursive: true });
  writeFileSync(join(out, dest), js);
};
transpile('dashboard/frontend/src/lib/mock/seed.ts', 'mock/seed.js');
transpile('dashboard/frontend/src/lib/mock/handlers.ts', 'mock/handlers.js');
transpile('landing/frontend/src/data/mockData.ts', 'fares/mockData.js');
transpile('landing/frontend/src/data/fares.ts', 'fares/fares.js');

// Freeze "now" so the fare search (days ahead) is reproducible.
const FIXED_NOW = Date.parse('2026-09-28T06:00:00Z');
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [FIXED_NOW])); }
  static now() { return FIXED_NOW; }
};

const { mockFetch } = await import(pathToFileURL(join(out, 'mock/handlers.js')));
const { searchFares } = await import(pathToFileURL(join(out, 'fares/fares.js')));

const call = (path, query = {}) => mockFetch(path, new URLSearchParams(query)).data;
const result = {
  index_latest: Object.fromEntries(['AFI', 'TCT-AFI', 'ANC-AFI'].map((s) => [s, call('index/latest', { series: s })])),
  index_latest_mid: call('index/latest', { series: 'AFI', date: '2026-09-12' }),
  index_history: call('index/history', { series: 'AFI,TCT-AFI,ANC-AFI' }),
  index_history_window: call('index/history', { series: 'AFI', from: '2026-09-20', to: '2026-09-25' }),
  index_family: call('index/family'),
  attribution: Object.fromEntries(
    ['2026-08-30', '2026-09-12', '2026-09-20', '2026-09-27'].flatMap((d) =>
      ['AFI', 'TCT-AFI'].map((s) => [`${d}|${s}`, call(`index/attribution/${d}`, { series: s })])),
  ),
  routes: call('routes'),
  routes_mid: call('routes', { date: '2026-09-10' }),
  route_fares: call('routes/DEL-BOM/fares'),
  observations: call('observations', { date: '2026-09-10' }),
  observations_route: call('observations', { date: '2026-09-27', route: 'BLR-HYD' }),
  lead_time: call('lead-time/matrix'),
  lead_time_blocked: call('lead-time/matrix', { date: '2026-09-10' }),
  coverage: call('quality/coverage'),
  sources: call('sources'),
  runs: call('health').runs,
};
result.observation_audit = Object.fromEntries(
  result.observations.slice(0, 5).map((o) => [o.observation_id, call(`observations/${o.observation_id}`)]),
);
result.fares = Object.fromEntries(
  [['DEL', 'BOM', '2026-10-05'], ['BOM', 'DEL', '2026-10-17'], ['BLR', 'HYD', '2026-09-29'], ['CCU', 'DEL', '2026-11-10']]
    .map(([f, t, d]) => [`${f}-${t}-${d}`, searchFares(f, t, d)]),
);
result.fares_now = new RealDate(FIXED_NOW).toISOString();

const dest = join(here, '..', 'fixtures', 'mock_parity.json');
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(result));
console.log(`wrote ${dest}`);
