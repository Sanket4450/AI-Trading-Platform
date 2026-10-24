import { prettyJson } from '@/lib/format';

export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  return (
    <pre
      className={`border-border/70 text-muted-foreground max-h-80 overflow-auto rounded-lg border bg-black/30 p-3 text-xs leading-5 ${className ?? ''}`}
    >
      {prettyJson(value)}
    </pre>
  );
}
