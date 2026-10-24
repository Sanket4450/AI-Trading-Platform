import path from 'node:path';
import { config } from 'dotenv';

// Package-level scripts run from packages/database. The workspace .env is two
// levels up and remains the single source of truth for DATABASE_URL.
config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });
