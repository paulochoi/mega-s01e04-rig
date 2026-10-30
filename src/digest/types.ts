// Plan morning-digest § 1. The contract every part of § 2 builds against: commit this first.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, once parsed.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night.
export type DigestRow = {
  job: string;
  // null when the log says so; views show it as —.
  owner: string | null;
  // Every line for this job.
  runs: number;
  // Lines with status "retry".
  retries: number;
  // Status of the job's last line.
  lastStatus: RunStatus;
  // The last error the job logged, if any.
  lastError: string | null;
  // `at` of the first and last line, offset kept as logged (never converted to UTC).
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  // Sorted by job.
  rows: DigestRow[];
  // Lines that didn't parse: counted, never thrown.
  badLines: number;
};

// Reads runs/<night>.jsonl. Returns null when the night has no file; an empty file gives no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
