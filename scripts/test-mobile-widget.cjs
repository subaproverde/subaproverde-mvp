const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('app/api/mobile/widget/route.ts', 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const instant = '2026-09-09T02:50:00.000Z'; // Still September 8 in São Paulo.
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [instant])); } }

async function run(mode = 'admin') {
  const queries = [];
  const api = { from(table) {
    const query = { table, filters: [], count: false };
    queries.push(query);
    const chain = {
      select(fields, options) { query.count = !!options?.count; return chain; },
      then(resolve, reject) {
        let data = []; let count = null;
        if (query.count) count = table === 'crm_tasks' ? (query.filters.some(([op]) => op === 'gte') ? 1005 : 2030) : 1501;
        else if (table === 'crm_tasks') data = [{ id: query.filters.some(([op]) => op === 'gte') ? 'next' : 'late', contact_id: 'client', title: 'Atendimento', due_at: query.filters.some(([op]) => op === 'gte') ? '2026-09-09T16:00:00Z' : '2026-09-08T16:00:00Z', status: 'pending', priority: 'medium' }];
        else if (table === 'crm_contacts') data = [{ id: 'client', name: 'Cliente correto' }];
        return Promise.resolve({ data, count, error: mode === 'db-error' ? { code: 'error' } : null }).then(resolve, reject);
      },
    };
    for (const op of ['eq', 'in', 'gte', 'lt', 'lte', 'or', 'order', 'limit']) chain[op] = (...args) => { query.filters.push([op, ...args]); return chain; };
    return chain;
  } };
  const exports = {};
  const json = (body, init = {}) => ({ body, status: init.status || 200, headers: init.headers });
  vm.runInNewContext(js, { exports, Date: Clock, Intl, Map, Set, encodeURIComponent, require(name) {
    if (name === 'next/server') return { NextResponse: { json } };
    if (name === '@/lib/apiAuth') return { supabaseApiAdmin: api, requireAdminRequest: async () => mode === 'anonymous' ? { ok: false, status: 401 } : mode === 'non-admin' ? { ok: false, status: 403 } : { ok: true }, authErrorResponse: (auth) => json({}, { status: auth.status }) };
    if (name === '@/lib/crm/server') return { getCrmWorkspace: async () => ({ workspace: mode === 'missing-workspace' ? null : { id: 'our-workspace' } }) };
    throw Error(name);
  } });
  const response = await exports.GET({});
  return { response, queries };
}

(async () => {
  for (const [mode, expected] of [['anonymous', 401], ['non-admin', 403], ['missing-workspace', 404]]) {
    const { response, queries } = await run(mode);
    assert.equal(response.status, expected); assert.equal(queries.length, 0);
  }
  const { response, queries } = await run();
  assert.equal(response.status, 200);
  assert.equal(response.body.metrics.today, 1005); assert.equal(response.body.metrics.overdue, 2030);
  assert.equal(response.body.metrics.activeLeads, 1501);
  assert.equal(response.body.tasks[0].id, 'next'); assert.equal(response.body.tasks[1].id, 'late');
  assert.equal(response.body.tasks[0].contactName, 'Cliente correto');
  assert.match(response.body.tasks[0].deepLink, /taskId=next&date=/);
  assert.equal(response.headers['Cache-Control'], 'private, no-store');
  assert.ok(queries.every((q) => q.filters.some(([op, key, value]) => op === 'eq' && key === 'workspace_id' && value === 'our-workspace')));
  const today = queries.find((q) => q.count && q.table === 'crm_tasks' && q.filters.some(([op]) => op === 'gte'));
  assert.ok(today.filters.some(([op, key, value]) => op === 'gte' && key === 'due_at' && value === '2026-09-08T03:00:00.000Z'));
  assert.ok(today.filters.some(([op, key, value]) => op === 'lt' && key === 'due_at' && value === '2026-09-09T03:00:00.000Z'));
  assert.equal((await run('db-error')).response.status, 500);
  console.log('PASS: authentication gate, workspace isolation, São Paulo midnight, exact counts, task links, no-store and database failure.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
