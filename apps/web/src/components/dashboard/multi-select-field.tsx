'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type MultiSelectOption = {
  value: string;
  /** Primary line, such as a trading symbol. */
  label: string;
  /** Secondary line, shown muted under the label. */
  description?: string;
};

/**
 * Searchable multi-select. Selections are mirrored into repeated hidden inputs so the surrounding
 * FormData contract keeps working, and clearing the selection falls back to the caller's default.
 */
export function MultiSelectField({
  id,
  name,
  options,
  placeholder,
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matches',
  className,
}: {
  id?: string;
  name: string;
  options: readonly MultiSelectOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(term) ||
        option.description?.toLowerCase().includes(term),
    );
  }, [options, query]);

  const selectedLabels = options
    .filter((option) => selectedSet.has(option.value))
    .map((option) => option.label);

  function toggle(value: string) {
    setSelected((current) =>
      current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value],
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {selected.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className="text-foreground h-8 w-full justify-between px-2.5 font-normal"
          >
            <span className="min-w-0 flex-1 truncate text-left">
              {selectedLabels.length === 0 ? (
                <span className="text-muted-foreground">{placeholder}</span>
              ) : selectedLabels.length <= 2 ? (
                selectedLabels.join(' · ')
              ) : (
                `${selectedLabels.slice(0, 2).join(' · ')} +${selectedLabels.length - 2}`
              )}
            </span>
            <ChevronDown className="text-muted-foreground size-4 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0"
        >
          <div className="border-border/70 border-b p-2">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                autoFocus
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
          <div
            role="listbox"
            aria-multiselectable="true"
            aria-label={placeholder}
            className="max-h-56 overflow-y-auto p-1"
          >
            {filtered.length === 0 ? (
              <p className="text-muted-foreground p-3 text-center text-xs">{emptyMessage}</p>
            ) : (
              filtered.map((option) => {
                const isSelected = selectedSet.has(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(option.value)}
                    className={cn(
                      'hover:bg-muted flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                      isSelected && 'bg-muted/60',
                    )}
                  >
                    <span
                      className={cn(
                        'border-input mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border',
                        isSelected && 'border-primary bg-primary text-primary-foreground',
                      )}
                    >
                      {isSelected ? <Check className="size-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{option.label}</span>
                      {option.description ? (
                        <span
                          className="text-muted-foreground block truncate text-[11px]"
                          title={option.description}
                        >
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-border/70 flex items-center justify-between gap-2 border-t px-2 py-1.5">
            <span className="text-muted-foreground text-[11px]">
              {selected.length === 0 ? placeholder : `${selected.length} selected`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={selected.length === 0}
              onClick={() => setSelected([])}
              className="h-6 px-2 text-[11px]"
            >
              Clear
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
