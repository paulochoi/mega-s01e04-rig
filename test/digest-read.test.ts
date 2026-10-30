import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const tmp = mkdtempSync(join(tmpdir(), 'rig-digest-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl: 5 jobs, 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    expect(night!.night).toBe('2026-10-28');
    expect(night!.rows).toHaveLength(5);
    expect(night!.badLines).toBe(1);
    const jobs = night!.rows.map((r) => r.job);
    expect(jobs).toEqual([...jobs].sort());

    const refresh = night!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(refresh).toMatchObject({
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    const backup = night!.rows.find((r) => r.job === 'notes/backup')!;
    expect(backup).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', retries: 0 });
  });

  it('keeps a row whose owner is null', () => {
    const night = readNight('runs', '2026-10-28')!;
    const render = night.rows.find((r) => r.job === 'digest/render')!;
    expect(render.owner).toBeNull();
    expect(render.lastError).toBeNull();
  });

  it('keeps an owner null row in a temp night', () => {
    writeFileSync(
      join(tmp, '2026-01-02.jsonl'),
      '{"at":"2026-01-02T03:00:00-05:00","job":"a/job","status":"ok","owner":null}\n',
    );
    const night = readNight(tmp, '2026-01-02')!;
    expect(night.rows).toEqual([
      {
        job: 'a/job',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-01-02T03:00:00-05:00',
        lastAt: '2026-01-02T03:00:00-05:00',
      },
    ]);
    expect(night.badLines).toBe(0);
  });

  it('counts invalid lines as bad, never throws', () => {
    writeFileSync(
      join(tmp, '2026-01-03.jsonl'),
      [
        '{"at":"2026-01-03T01:00:00+01:00","job":"x","status":"nope","owner":"r"}',
        '{"at":"not a date","job":"x","status":"ok","owner":"r"}',
        '{"at":"2026-01-03T01:00:00+01:00","job":"x","status":"ok","owner":7}',
        '[1,2]',
        '{"at":"2026-01-03T01:00:00+01:00","job":"x","status":"ok","owner":"r"}',
      ].join('\n'),
    );
    const night = readNight(tmp, '2026-01-03')!;
    expect(night.badLines).toBe(4);
    expect(night.rows).toHaveLength(1);
  });

  it('empty night (or only blank lines) gives no rows and no bad lines', () => {
    writeFileSync(join(tmp, '2026-01-01.jsonl'), '');
    expect(readNight(tmp, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0 });
    writeFileSync(join(tmp, '2026-01-04.jsonl'), '\n  \n\n');
    expect(readNight(tmp, '2026-01-04')).toEqual({ night: '2026-01-04', rows: [], badLines: 0 });
  });

  it('missing night returns null', () => {
    expect(readNight(tmp, '1999-12-31')).toBeNull();
  });
});
