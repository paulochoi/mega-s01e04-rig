import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunLine, RunStatus } from './types.js';

const STATUSES: readonly RunStatus[] = ['ok', 'retry', 'fail'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStatus(v: unknown): v is RunStatus {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}

// Parses one log line at the edge; null when it doesn't parse or fails validation.
export function parseRunLine(raw: string): RunLine | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const { at, job, status, owner, error } = value;
  if (typeof at !== 'string' || at === '' || Number.isNaN(Date.parse(at))) return null;
  if (typeof job !== 'string' || job === '') return null;
  if (!isStatus(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && typeof error !== 'string') return null;
  const line: RunLine = { at, job, status, owner };
  if (error !== undefined) line.error = error;
  return line;
}

export const readNight: ReadNight = (runsDir, night) => {
  const path = join(runsDir, `${night}.jsonl`);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');

  const byJob = new Map<string, RunLine[]>();
  let badLines = 0;
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue;
    const line = parseRunLine(raw);
    if (line === null) {
      badLines++;
      continue;
    }
    const lines = byJob.get(line.job);
    if (lines) lines.push(line);
    else byJob.set(line.job, [line]);
  }

  const rows: DigestRow[] = [];
  for (const [job, lines] of byJob) {
    const first = lines[0]!;
    const last = lines[lines.length - 1]!;
    let lastError: string | null = null;
    for (const l of lines) if (l.error !== undefined) lastError = l.error;
    rows.push({
      job,
      owner: last.owner,
      runs: lines.length,
      retries: lines.filter((l) => l.status === 'retry').length,
      lastStatus: last.status,
      lastError,
      firstAt: first.at,
      lastAt: last.at,
    });
  }
  rows.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
};
