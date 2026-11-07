'use client';

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarIcon, ChevronDownIcon, ListFilterIcon, SearchIcon, XIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SelectField, type SelectOption } from '@/components/dashboard/form-select';
import { cn } from '@/lib/utils';

/**
 * One-row filter bar. Every control in a table header must render through this form so filtering
 * behaves the same on every page.
 */
export function TableFilters({ children, className }: { children: ReactNode; className?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function apply() {
    const form = formRef.current;
    if (!form) return;

    const next = new URLSearchParams();
    for (const [key, value] of new FormData(form).entries()) {
      if (typeof value !== 'string' || value === '') continue;
      if (next.has(key)) next.append(key, value);
      else next.set(key, value);
    }

    const query = next.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function handleChange(event: ChangeEvent<HTMLFormElement>) {
    if (timerRef.current) clearTimeout(timerRef.current);

    const target = event.target;
    const isTyping =
      target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'search');

    if (isTyping) {
      timerRef.current = setTimeout(apply, 350);
      return;
    }

    apply();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (timerRef.current) clearTimeout(timerRef.current);
    apply();
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onChange={handleChange}
      className={cn('flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2', className)}
    >
      {children}
    </form>
  );
}

export function SearchFilter({
  name = 'search',
  defaultValue = '',
  placeholder = 'Search…',
  className,
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [clearTicket, setClearTicket] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    if (clearTicket === 0) return;
    inputRef.current?.form?.requestSubmit();
  }, [clearTicket]);

  function clear() {
    setValue('');
    setClearTicket((ticket) => ticket + 1);
  }

  return (
    <div className={cn('relative w-full sm:w-72 xl:w-80', className)}>
      <SearchIcon className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
      <Input
        ref={inputRef}
        name={name}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 pl-8 pr-8 text-xs [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          title="Clear search"
          onClick={clear}
          className="text-muted-foreground hover:text-foreground hover:bg-muted absolute right-1 top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md transition-colors"
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function FilterSelect({
  id,
  name,
  defaultValue = '',
  options,
  className,
  submitOnChange = false,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  options: readonly SelectOption[];
  className?: string;
  submitOnChange?: boolean;
}) {
  return (
    <SelectField
      id={id}
      name={name}
      defaultValue={defaultValue}
      options={options}
      ariaLabel={`Filter by ${name}`}
      leadingIcon={<ListFilterIcon className="text-muted-foreground size-3.5 shrink-0" />}
      className={cn('h-8 w-auto min-w-36 text-xs', className)}
      submitOnChange={submitOnChange}
    />
  );
}

/**
 * Dropdown with checkbox options. Selected values submit as repeated query parameters, so a
 * single component covers both single-value and multi-value filters.
 */
export function MultiSelectFilter({
  id,
  name,
  defaultValue = [],
  options,
  placeholder = 'Filter',
  className,
}: {
  id: string;
  name: string;
  defaultValue?: string[];
  options: readonly SelectOption[];
  placeholder?: string;
  className?: string;
}) {
  const [values, setValues] = useState<string[]>(defaultValue);
  const dirtyRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dirtyRef.current = false;
    setValues(defaultValue);
    // Reset only when the URL-provided defaults change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue.join('\u0000')]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    containerRef.current?.closest('form')?.requestSubmit();
  }, [values]);

  const selectedLabels = options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label);

  const triggerLabel =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? selectedLabels[0]
        : `${values.length} selected`;

  return (
    <div ref={containerRef} className={cn('shrink-0', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            size="sm"
            className="h-8 max-w-56 justify-between gap-2 text-xs font-normal"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <ListFilterIcon className="text-muted-foreground size-3.5 shrink-0" />
              <span className="truncate">{triggerLabel}</span>
            </span>
            {values.length > 1 ? (
              <span className="bg-primary/15 text-primary-strong rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                {values.length}
              </span>
            ) : (
              <ChevronDownIcon className="text-muted-foreground size-3.5 shrink-0" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" collisionPadding={8} className="min-w-52">
          <DropdownMenuLabel>{placeholder}</DropdownMenuLabel>
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={values.includes(option.value)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) => {
                dirtyRef.current = true;
                setValues((current) =>
                  checked
                    ? [...current, option.value]
                    : current.filter((value) => value !== option.value),
                );
              }}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
          {values.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  dirtyRef.current = true;
                  setValues([]);
                }}
              >
                <XIcon className="size-3.5" />
                Clear selection
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {values.map((value) => (
        <input key={value} type="hidden" name={name} value={value} readOnly />
      ))}
    </div>
  );
}

function atNoon(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  return copy;
}

function parseIsoDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

function toIsoDate(date: Date | undefined): string {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShort(date: Date | undefined): string {
  if (!date) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function daysAgo(days: number): Date {
  const date = atNoon(new Date());
  date.setDate(date.getDate() - (days - 1));
  return date;
}

function DateFilterTrigger({
  label,
  active,
  className,
}: {
  label: string;
  active: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'h-8 justify-start gap-2 text-xs font-normal',
        active && 'border-primary/40 bg-primary/5',
        className,
      )}
    >
      <CalendarIcon className="text-muted-foreground size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
      <ChevronDownIcon className="text-muted-foreground size-3.5 shrink-0" />
    </Button>
  );
}

/** Shared range picker with calendar, quick presets and explicit Apply/Clear. */
export function DateRangeFilter({
  fromName = 'from',
  toName = 'to',
  defaultFrom,
  defaultTo,
  className,
}: {
  fromName?: string;
  toName?: string;
  defaultFrom?: string;
  defaultTo?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = parseIsoDate(defaultFrom);
    const to = parseIsoDate(defaultTo);
    return from || to ? { from, to } : undefined;
  });
  const [draft, setDraft] = useState<DateRange | undefined>(range);
  const [submitTicket, setSubmitTicket] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const from = parseIsoDate(defaultFrom);
    const to = parseIsoDate(defaultTo);
    const next = from || to ? { from, to } : undefined;
    setRange(next);
    setDraft(next);
  }, [defaultFrom, defaultTo]);

  useEffect(() => {
    if (submitTicket === 0) return;
    containerRef.current?.closest('form')?.requestSubmit();
  }, [submitTicket]);

  const label =
    range?.from && range?.to
      ? `${formatShort(range.from)} – ${formatShort(range.to)}`
      : range?.from
        ? `From ${formatShort(range.from)}`
        : 'Date range';

  function submit(next: DateRange | undefined) {
    setRange(next);
    setOpen(false);
    setSubmitTicket((value) => value + 1);
  }

  return (
    <div ref={containerRef} className={cn('shrink-0', className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setDraft(range);
        }}
      >
        <PopoverTrigger asChild>
          <DateFilterTrigger label={label} active={Boolean(range?.from || range?.to)} />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="range"
            selected={draft}
            defaultMonth={draft?.from ?? new Date()}
            onSelect={setDraft}
            numberOfMonths={1}
          />
          <div className="border-border/70 flex flex-wrap items-center justify-between gap-2 border-t p-2">
            <div className="flex flex-wrap items-center gap-1">
              {[7, 30, 90].map((days) => (
                <Button
                  key={days}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => submit({ from: daysAgo(days), to: atNoon(new Date()) })}
                >
                  Last {days}d
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => submit(undefined)}
              >
                Clear
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 px-2 text-[11px]"
                disabled={!draft?.from}
                onClick={() => submit(draft)}
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <input type="hidden" name={fromName} value={toIsoDate(range?.from)} readOnly />
      <input type="hidden" name={toName} value={toIsoDate(range?.to ?? range?.from)} readOnly />
    </div>
  );
}

/** Single-date variant that shares the same trigger, calendar and URL contract. */
export function DateFilter({
  name = 'date',
  defaultValue,
  placeholder = 'Any date',
  className,
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(() => parseIsoDate(defaultValue));
  const [submitTicket, setSubmitTicket] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDate(parseIsoDate(defaultValue));
  }, [defaultValue]);

  useEffect(() => {
    if (submitTicket === 0) return;
    containerRef.current?.closest('form')?.requestSubmit();
  }, [submitTicket]);

  function submit(next: Date | undefined) {
    setDate(next);
    setOpen(false);
    setSubmitTicket((value) => value + 1);
  }

  return (
    <div ref={containerRef} className={cn('shrink-0', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <DateFilterTrigger
            label={date ? formatShort(date) : placeholder}
            active={Boolean(date)}
          />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date ?? new Date()}
            onSelect={(next) => submit(next)}
          />
          <div className="border-border/70 flex justify-end border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => submit(undefined)}
            >
              Clear
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <input type="hidden" name={name} value={toIsoDate(date)} readOnly />
    </div>
  );
}
