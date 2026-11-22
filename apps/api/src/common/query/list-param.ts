/** Normalizes a repeated or comma-separated query parameter into a trimmed list. */
export function toList(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;

  const items: unknown[] = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const values: string[] = [];
  for (const item of items) {
    if (typeof item === 'string') values.push(item.trim());
    else if (typeof item === 'number' || typeof item === 'boolean') values.push(String(item));
  }
  return values.filter(Boolean);
}
