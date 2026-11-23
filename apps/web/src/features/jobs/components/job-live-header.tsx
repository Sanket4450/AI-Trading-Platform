'use client';

import { useEffect, useState } from 'react';
import { label } from '@/lib/labels';
import type { BackLink } from '@/lib/navigation';
import { connectJobs } from '@/lib/realtime';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { StatusBadge } from '@/components/dashboard/status-badge';

/**
 * Detail-page strip whose status and attempt follow the run broadcast, so the page header cannot
 * disagree with the live stage rail while a job is in flight.
 */
export function JobLiveHeader({
  jobRunId,
  jobName,
  queueName,
  status,
  attempt,
  maxAttempts,
  back,
}: {
  jobRunId: string;
  jobName: string;
  queueName: string;
  status: string;
  attempt: number;
  maxAttempts: number;
  back: BackLink;
}) {
  const [live, setLive] = useState({ status, attempt });

  useEffect(() => {
    setLive({ status, attempt });
  }, [status, attempt]);

  useEffect(
    () =>
      connectJobs((message) => {
        if (message.type !== 'run' || message.run.id !== jobRunId) return;
        setLive({ status: message.run.status, attempt: message.run.attempt });
      }),
    [jobRunId],
  );

  return (
    <DetailHeader
      back={back}
      badges={<StatusBadge status={live.status} />}
      meta={`${label(jobName)} · ${label(queueName)} · attempt ${live.attempt}/${maxAttempts}`}
    />
  );
}
