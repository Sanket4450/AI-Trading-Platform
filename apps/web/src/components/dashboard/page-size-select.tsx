'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { PAGINATION_LIMIT_OPTIONS } from '@ai-trading/domain';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PAGINATION_KEYS = ['offset', 'after', 'before'];

/** Page-size control. Changing it resets pagination but keeps every filter. */
export function PageSizeSelect({
  value,
  resetKeys = PAGINATION_KEYS,
}: {
  value: number;
  /** Paginator params owned by this list, cleared when the size changes. */
  resetKeys?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const options = Array.from(
    new Set<number>([...PAGINATION_LIMIT_OPTIONS, value]),
  ).sort((a, b) => a - b);

  function change(next: string) {
    const query = new URLSearchParams(searchParams.toString());
    for (const key of resetKeys) query.delete(key);
    query.set('limit', next);
    startTransition(() => {
      router.replace(`${pathname}?${query.toString()}`, { scroll: false });
    });
  }

  return (
    <Select value={String(value)} onValueChange={change}>
      <SelectTrigger
        size="sm"
        aria-label="Rows per page"
        className="text-muted-foreground h-7 gap-1.5 px-2 text-xs"
      >
        <span className="text-[10px] uppercase tracking-[0.14em]">Rows</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="min-w-24">
        {options.map((option) => (
          <SelectItem key={option} value={String(option)}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
