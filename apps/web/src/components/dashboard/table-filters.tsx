'use client';

import { useEffect, useRef, useTransition, type ChangeEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
      if (typeof value === 'string' && value !== '') next.set(key, value);
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
      className={cn('flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5', className)}
    >
      {children}
    </form>
  );
}

export function FilterField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('shrink-0 space-y-1', className)}>
      <Label
        htmlFor={htmlFor}
        className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide"
      >
        {label}
      </Label>
      {children}
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
      className={cn('h-8 text-xs', className)}
      submitOnChange={submitOnChange}
    />
  );
}

export function FilterReset({ href }: { href: string }) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'shrink-0')}>
      Reset
    </Link>
  );
}
