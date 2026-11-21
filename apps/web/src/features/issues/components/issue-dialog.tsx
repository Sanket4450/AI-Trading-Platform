'use client';

import { useEffect, useState } from 'react';
import type { SystemIssue } from '@/lib/types';
import { apiRequest } from '@/lib/api-browser';
import { label } from '@/lib/labels';
import { DetailDialog } from '@/components/dashboard/detail-dialog';
import { TableActionButton } from '@/components/dashboard/table-actions';
import { Skeleton } from '@/components/ui/skeleton';
import { IssueDetailContent } from './issue-detail';
import type { IssuePreview } from '../issue-format';

function IssueDialogSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="flex flex-wrap gap-1.5">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/**
 * Shared issue dialog. Every issue row uses the same eye trigger and reads the canonical row so
 * list endpoints can keep returning only the compact fields.
 */
export function IssueDialog({
  issue,
  from,
  currentInstrumentId,
}: {
  issue: IssuePreview;
  from: string;
  currentInstrumentId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<SystemIssue | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;

    let active = true;

    apiRequest<SystemIssue>(`/issues/${issue.id}`)
      .then((loaded) => {
        if (active) setDetail(loaded);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [open, issue.id]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setDetail(null);
      setFailed(false);
    }
  }

  return (
    <DetailDialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={<TableActionButton label="View issue" className="shrink-0" />}
      title={label(issue.kind)}
      description={`${label(issue.source)} · ${issue.symbol ?? 'System-wide'}`}
      className="sm:max-w-2xl"
    >
      {failed ? (
        <p className="text-muted-foreground text-sm">
          This issue could not be loaded. It may have been resolved since the page rendered.
        </p>
      ) : detail ? (
        <IssueDetailContent
          issue={detail}
          from={from}
          currentInstrumentId={currentInstrumentId}
        />
      ) : (
        <IssueDialogSkeleton />
      )}
    </DetailDialog>
  );
}
