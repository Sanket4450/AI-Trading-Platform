import { customType } from 'drizzle-orm/pg-core';

/**
 * PostgreSQL `bytea` is not first-class in Drizzle's pg-core helpers.
 * The driver receives a Node Buffer, which is what postgres.js expects.
 */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});
