'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const EMPTY_VALUE = '__empty__';

export type SelectOption = {
  value: string;
  label: ReactNode;
};

type SelectFieldProps = {
  id?: string;
  name: string;
  defaultValue?: string;
  options: readonly SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  submitOnChange?: boolean;
  onValueChange?: (value: string) => void;
};

/**
 * Shared listbox used by forms and table filters. The hidden input keeps the selected value in the
 * surrounding HTML form so server actions and GET filters keep working.
 */
export function SelectField({
  id,
  name,
  defaultValue = '',
  options,
  placeholder,
  className,
  disabled,
  submitOnChange,
  onValueChange,
}: SelectFieldProps) {
  const [value, setValue] = useState(defaultValue);
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const hasEmptyOption = options.some((option) => option.value === '');
  const selectValue = value === '' ? (hasEmptyOption ? EMPTY_VALUE : undefined) : value;

  return (
    <>
      <Select
        value={selectValue}
        disabled={disabled}
        onValueChange={(next) => {
          const nextValue = next === EMPTY_VALUE ? '' : next;
          setValue(nextValue);
          if (hiddenRef.current) {
            hiddenRef.current.value = nextValue;
            if (submitOnChange) hiddenRef.current.form?.requestSubmit();
          }
          onValueChange?.(nextValue);
        }}
      >
        <SelectTrigger id={id} className={cn('w-full', className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value || EMPTY_VALUE}
              value={option.value === '' ? EMPTY_VALUE : option.value}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input ref={hiddenRef} type="hidden" name={name} value={value} readOnly />
    </>
  );
}

export function FormSelect(props: Omit<SelectFieldProps, 'submitOnChange'>) {
  return <SelectField {...props} />;
}
