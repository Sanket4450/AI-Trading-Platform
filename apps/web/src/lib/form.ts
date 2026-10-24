/**
 * FormData values are `string | File`. Server actions only accept text fields,
 * so this helper keeps the narrowing explicit and avoids stringifying a File.
 */
export function formString(formData: FormData, key: string, fallback = ''): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : fallback;
}
