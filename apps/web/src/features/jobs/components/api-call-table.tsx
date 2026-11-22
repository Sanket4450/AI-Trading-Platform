import Link from 'next/link';
import type { ExternalApiCall } from '@/lib/types';
import { formatDateTime, formatDuration } from '@/lib/format';
import { label } from '@/lib/labels';
import { detailHref } from '@/lib/navigation';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableActions } from '@/components/dashboard/table-actions';
import { cn } from '@/lib/utils';
import { apiOperationLabel, apiOutcomeMeta, apiServiceLabel } from '../api-call-labels';
import { ApiCallDialog } from './api-call-dialog';

/**
 * The call table shared by the job page and the global feed. One column set keeps the two views
 * readable the same way; the global feed adds the owning job and remembers its own origin.
 */
export function ApiCallTable({
  calls,
  showJob = false,
  from,
  containerClassName,
}: {
  calls: ExternalApiCall[];
  showJob?: boolean;
  /** Origin page, so the job link can restore this page's filters. */
  from?: string;
  containerClassName?: string;
}) {
  return (
    <Table containerClassName={containerClassName ?? 'h-full overflow-auto'}>
      <TableHeader className="bg-card sticky top-0 z-10">
        <TableRow>
          <TableHead>Operation</TableHead>
          {showJob ? <TableHead>Job</TableHead> : null}
          <TableHead>Outcome</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Latency</TableHead>
          <TableHead>Started</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {calls.map((call) => {
          const meta = apiOutcomeMeta(call.outcome);
          return (
            <TableRow key={call.id}>
              <TableCell>
                <div className="flex items-start gap-2">
                  <span className="border-border/70 bg-muted/40 text-muted-foreground mt-0.5 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                    {call.method}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">
                      {apiOperationLabel(call.operation)}
                    </p>
                    <p className="text-muted-foreground truncate text-[11px]">
                      {apiServiceLabel(call.service)}
                      {call.instrumentSymbol ? ` · ${call.instrumentSymbol}` : ''}
                    </p>
                  </div>
                </div>
              </TableCell>
              {showJob ? (
                <TableCell className="text-xs">
                  {call.jobRunId ? (
                    <Link
                      href={detailHref(`/jobs/${call.jobRunId}`, from ?? '/api-calls')}
                      className="text-info hover:underline"
                    >
                      {call.jobName ? label(call.jobName) : 'Job run'}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Outside a job</span>
                  )}
                </TableCell>
              ) : null}
              <TableCell>
                <Badge variant="outline" className={cn(meta.badgeClass)}>
                  {meta.label}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-xs">{call.statusCode ?? '—'}</TableCell>
              <TableCell className="text-xs">{formatDuration(call.latencyMs)}</TableCell>
              <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                {formatDateTime(call.startedAt)}
              </TableCell>
              <TableActions>
                <ApiCallDialog call={call} />
              </TableActions>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
