import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest page', () => {
  it('renders the night', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-10-28');
    expect(html).toContain('lane/sync');
  });

  it('404s on a missing or malformed night', async () => {
    expect((await createApp(config).request('/digest/2020-01-01')).status).toBe(404);
    expect((await createApp(config).request('/digest/nope')).status).toBe(404);
  });
});
