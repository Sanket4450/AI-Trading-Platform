import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false, coerceTypes: false });

export function validateJsonSchema(schema: Record<string, unknown>, payload: unknown): string[] {
  const validate = ajv.compile(schema);
  if (validate(payload)) return [];
  return (validate.errors ?? []).map((error) => {
    const path = error.instancePath || '/';
    return `${path} ${error.message ?? 'is invalid'}`.trim();
  });
}
