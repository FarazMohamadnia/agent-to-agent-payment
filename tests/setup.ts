import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const testDbPath = path.join(__dirname, '..', 'prisma', 'test.db');
const testDbJournal = `${testDbPath}-journal`;
const testDbWal = `${testDbPath}-wal`;
const testDbShm = `${testDbPath}-shm`;

for (const p of [testDbPath, testDbJournal, testDbWal, testDbShm]) {
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// Create a fresh throwaway SQLite file (no --force-reset; safe for local test DB only)
execSync('npx prisma db push --skip-generate', {
  env: {
    ...process.env,
    DATABASE_URL: `file:${testDbPath}`,
  },
  stdio: 'pipe',
  cwd: path.join(__dirname, '..'),
});
