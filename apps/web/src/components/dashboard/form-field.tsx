import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export { FormSelect } from '@/components/dashboard/form-select';

/** Shared field wrapper so every form label, input and hint align the same way. */
export function FormField({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-[11px]">{hint}</p> : null}
    </div>
  );
}
