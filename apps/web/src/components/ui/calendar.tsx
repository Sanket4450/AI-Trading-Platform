'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { DayPicker, getDefaultClassNames, type DayPickerProps } from 'react-day-picker';
import { cn } from '@/lib/utils';

/** Shared shadcn calendar used by every date and date-range table filter. */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: DayPickerProps & { className?: string }) {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('bg-background relative p-1', className)}
      classNames={{
        root: cn(defaults.root, 'w-fit'),
        months: cn(defaults.months, 'flex flex-col gap-3 sm:flex-row'),
        month: cn(defaults.month, 'flex flex-col gap-3'),
        nav: cn(defaults.nav, 'absolute inset-x-1 top-1 flex items-center justify-between'),
        button_previous: cn(
          defaults.button_previous,
          'border-border/70 hover:bg-accent inline-flex size-7 items-center justify-center rounded-md border',
        ),
        button_next: cn(
          defaults.button_next,
          'border-border/70 hover:bg-accent inline-flex size-7 items-center justify-center rounded-md border',
        ),
        month_caption: cn(defaults.month_caption, 'flex h-7 items-center justify-center px-8'),
        caption_label: cn(defaults.caption_label, 'text-sm font-medium'),
        month_grid: cn(defaults.month_grid, 'w-full border-collapse'),
        weekdays: cn(defaults.weekdays, 'flex'),
        weekday: cn(
          defaults.weekday,
          'text-muted-foreground flex size-8 items-center justify-center text-[0.7rem] font-medium',
        ),
        week: cn(defaults.week, 'mt-1 flex w-full'),
        day: cn(defaults.day, 'relative size-8 p-0 text-center text-xs'),
        day_button: cn(
          defaults.day_button,
          'hover:bg-accent hover:text-accent-foreground inline-flex size-8 items-center justify-center rounded-md font-normal outline-none transition-colors',
        ),
        selected: cn(
          defaults.selected,
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
        ),
        range_start: cn(defaults.range_start, 'bg-primary/10 rounded-l-md'),
        range_middle: cn(defaults.range_middle, 'bg-primary/10'),
        range_end: cn(defaults.range_end, 'bg-primary/10 rounded-r-md'),
        today: cn(defaults.today, 'bg-accent text-accent-foreground rounded-md'),
        outside: cn(defaults.outside, 'text-muted-foreground opacity-40'),
        disabled: cn(defaults.disabled, 'text-muted-foreground opacity-40'),
        hidden: cn(defaults.hidden, 'invisible'),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeftIcon className="size-4" />
          ) : (
            <ChevronRightIcon className="size-4" />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
