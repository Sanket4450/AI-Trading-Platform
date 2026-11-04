import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * The single card structure used by every page. Title and filters share one header row so a
 * table's filters never stack into a second band.
 */
export function SectionCard({
  title,
  description,
  actions,
  toolbar,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const hasHeaderControls = Boolean(actions || toolbar);

  return (
    <Card className={cn('border-border/70 bg-card/60', className)}>
      <CardHeader>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {hasHeaderControls ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end">
              {toolbar}
              {actions}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
