import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

const packageDir = path.dirname(fileURLToPath(import.meta.url));

// The workspace .env is the single source of truth for DATABASE_URL.
config({ path: path.resolve(packageDir, '../../.env'), quiet: true });

export default defineConfig({
  schema: path.join(packageDir, 'schema/drizzle.ts'),
  out: path.join(packageDir, 'migrations'),
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
