import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

// Fixtures live in a temp dir. runs/ is read-only and never touched here.
let runsDir: string;

const line = (at: string, job: string, status: 'ok' | 'retry' | 'fail', owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

const NORMAL = '2026-10-28';
const EMPTY = '2026-10-29';
const BAD = '2026-10-27';
const MISSING = '2026-01-01';

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));

  // Normal night: jobs written out of order, so sorting by job is visible.
  writeFileSync(
    join(runsDir, `${NORMAL}.jsonl`),
    [
      line('2026-10-28T23:00:02+01:00', 'rotate-logs', 'ok', 'ana'),
      line('2026-10-28T23:00:05+01:00', 'backup-db', 'retry', 'bruno'),
      line('2026-10-28T23:00:09+01:00', 'backup-db', 'ok', 'bruno'),
      line('2026-10-28T23:01:00+01:00', 'email-digest', 'fail', null, 'smtp timeout'),
    ].join('\n') + '\n',
  );

  // Empty night: file exists, no lines.
  writeFileSync(join(runsDir, `${EMPTY}.jsonl`), '');

  // Bad-line night: one good line and one line that does not parse.
  writeFileSync(
    join(runsDir, `${BAD}.jsonl`),
    [line('2026-10-27T23:00:02+01:00', 'rotate-logs', 'ok', 'ana'), '{not json'].join('\n') + '\n',
  );
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

const app = () =>
  createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });

describe('GET /digest/:night', () => {
  it('renders one table with a row per job, sorted by job', async () => {
    const res = await app().request(`/digest/${NORMAL}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.match(/<table[\s>]/g)?.length).toBe(1);
    const positions = ['backup-db', 'email-digest', 'rotate-logs'].map((job) => html.indexOf(job));
    positions.forEach((p) => expect(p).toBeGreaterThanOrEqual(0));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('answers 404 for a night with no file', async () => {
    const res = await app().request(`/digest/${MISSING}`);
    expect(res.status).toBe(404);
  });

  it('says "nothing ran" for an empty night', async () => {
    const res = await app().request(`/digest/${EMPTY}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('still renders 200 for a night with a bad line', async () => {
    const res = await app().request(`/digest/${BAD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('rotate-logs');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns { night, rows, badLines } as JSON', async () => {
    const res = await app().request(`/api/digest/${NORMAL}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.night).toBe(NORMAL);
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['backup-db', 'email-digest', 'rotate-logs']);
  });

  it('answers 404 for a night with no file', async () => {
    const res = await app().request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
  });

  it('gives rows [] and badLines 0 for an empty night', async () => {
    const res = await app().request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('gives 200 and badLines 1 for a night with a bad line', async () => {
    const res = await app().request(`/api/digest/${BAD}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['rotate-logs']);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const page = await app().request(`/digest/${NORMAL}`);
    const html = await page.text();
    const api = await app().request(`/api/digest/${NORMAL}`);
    const body = (await api.json()) as Night;
    const jobs = body.rows.map((r) => r.job);
    const positions = jobs.map((job) => html.indexOf(job));
    positions.forEach((p) => expect(p).toBeGreaterThanOrEqual(0));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(jobs).toEqual(['backup-db', 'email-digest', 'rotate-logs']);
  });
});
