import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('GET /api/digest/:night', () => {
  it('returns the night with rows sorted by job', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.night).toBe('2026-10-28');
    const jobs = body.rows.map((r) => r.job);
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs).toEqual([...jobs].sort());
  });

  it('404s on a missing or malformed night', async () => {
    const app = createApp(config);
    const missing = await app.request('/api/digest/2026-01-01');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'no such night', night: '2026-01-01' });
    expect((await app.request('/api/digest/nope')).status).toBe(404);
  });
});
