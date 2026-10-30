import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunStatus } from './types.js';

export type StatusCounts = Record<RunStatus, number>;

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

// Counts run lines by status for runs/<night>.jsonl. Bad lines are skipped.
// Returns null when the file can't be read.
export function countStatuses(runsDir: string, night: string): StatusCounts | null {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      const status =
        typeof parsed === 'object' && parsed !== null && 'status' in parsed ? parsed.status : undefined;
      if (typeof status === 'string' && STATUSES.includes(status)) counts[status as RunStatus]++;
    } catch {
      // skip bad line
    }
  }
  return counts;
}
