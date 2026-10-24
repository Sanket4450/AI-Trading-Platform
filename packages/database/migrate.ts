import './load-env.js';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';

const migrationsDir = path.join(import.meta.dirname, 'migrations');

export async function runMigrations(connectionString: string): Promise<void> {
  const sql = postgres(connectionString, { max: 1, onnotice: () => undefined });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        checksum char(64) NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    if (files.length === 0) {
      throw new Error(`No migrations found in ${migrationsDir}`);
    }

    let applied = 0;

    for (const file of files) {
      const content = await readFile(path.join(migrationsDir, file), 'utf8');
      const checksum = createHash('sha256').update(content).digest('hex');
      const existing = await sql<{ checksum: string }[]>`
        SELECT checksum FROM schema_migrations WHERE filename = ${file}
      `;

      if (existing.length > 0) {
        if (existing[0].checksum !== checksum) {
          throw new Error(
            `Migration ${file} changed after it was applied. Add a new migration instead of editing history.`,
          );
        }
        console.log(`skip  ${file}`);
        continue;
      }

      console.log(`apply ${file}`);
      await sql.begin(async (transaction) => {
        await transaction.unsafe(content);
        await transaction`
          INSERT INTO schema_migrations (filename, checksum)
          VALUES (${file}, ${checksum})
        `;
      });
      applied += 1;
    }

    console.log(
      `Migrations complete: ${applied} applied, ${files.length - applied} already present.`,
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run migrations');
  }
  await runMigrations(connectionString);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
