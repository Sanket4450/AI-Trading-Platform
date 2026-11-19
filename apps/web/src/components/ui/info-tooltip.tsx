'use client';

import type { ComponentProps, ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type InfoTooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
} & Omit<ComponentProps<typeof TooltipTrigger>, 'asChild' | 'children' | 'className'>;

/**
 * Tooltip over a single trigger. Extra props are forwarded so the trigger can also be a Radix
 * `asChild` target, such as a dialog trigger or a dropdown item.
 */
export function InfoTooltip({
  content,
  children,
  side = 'bottom',
  align = 'center',
  className,
  ...triggerProps
}: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild {...triggerProps}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} align={align} className={className}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
