import Ajv from 'ajv';
import type { JsonSchema } from '@ai-trading/domain';

const ajv = new Ajv({ allErrors: true, strict: false, coerceTypes: false });

const compiled = new Map<string, ReturnType<Ajv['compile']>>();

/**
 * Validates an operator payload against the authoritative schema. Errors name the JSON path and
 * the expected constraint so the API can return an actionable 422.
 */
export function validateStrategyParameters(
  schema: JsonSchema,
  payload: unknown,
): string[] {
  const key = JSON.stringify(schema);
  let validate = compiled.get(key);
  if (!validate) {
    validate = ajv.compile(schema);
    compiled.set(key, validate);
  }
  if (validate(payload)) return [];
  return (validate.errors ?? []).map((error) => {
    const path = error.instancePath || '/';
    return `${path} ${error.message ?? 'is invalid'}`.trim();
  });
}
