import path from 'node:path';
import { config } from 'dotenv';

/**
 * Load the workspace .env before any module that reads process.env at import
 * time (notably the database client). Inline environment variables always win.
 */
export function loadEnvFiles(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
  ];

  for (const candidate of candidates) {
    config({ path: candidate, override: false, quiet: true });
  }
}
