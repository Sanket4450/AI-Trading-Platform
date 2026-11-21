import { apiFetch } from '@/lib/api';
import type { CoverageRow, SystemIssue } from '@/lib/types';
import { formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { backLinkFor, detailHref, type DetailSearchParams } from '@/lib/navigation';
import { PageMeta } from '@/components/shell/page-meta';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { IssueList } from '@/features/issues/components/issue-list';

interface DayDetail {
  instrument: { id: string; symbol: string; name: string; segment?: string; tickSize: string } | null;
  coverage: CoverageRow | null;
  issues: SystemIssue[];
}

export default async function InstrumentCoverageDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; date: string }>;
  searchParams: DetailSearchParams;
}) {
  const { id, date } = await params;
  const { from: fromParam } = await searchParams;
  const back = backLinkFor(fromParam, `/instruments/${id}`);
  const detail = await apiFetch<DayDetail>(`/instruments/${id}/coverage/${date}`);
  const coverage = detail.coverage;
  const missing = coverage ? Math.max(coverage.expectedBars - coverage.storedBars, 0) : 0;

  return (
    <div>
      <PageMeta title={`${detail.instrument?.symbol ?? id} · ${date}`} />

      <DetailHeader
        back={back}
        badges={
          coverage ? (
            <StatusBadge status={coverage.status} />
          ) : null
        }
        meta={`${label(detail.instrument?.segment, 'NSE')} · tick ${detail.instrument?.tickSize ? formatNumber(detail.instrument.tickSize) : '—'}`}
        links={[
          {
            href: detailHref(`/instruments/${id}`, back.href),
            label: 'Instrument',
          },
        ]}
      />

      <StatGrid columns={3}>
        <StatCard
          label="Expected"
          value={formatNumber(coverage?.expectedBars ?? 0)}
          hint="Session minutes"
          tone="info"
        />
        <StatCard
          label="Stored"
          value={formatNumber(coverage?.storedBars ?? 0)}
          hint="Distinct in-session minutes"
          tone="success"
        />
        <StatCard
          label="Missing"
          value={formatNumber(missing)}
          hint="Expected minus stored"
          tone={missing > 0 ? 'warning' : 'success'}
        />
      </StatGrid>

      <SectionCard
        className="mt-4"
        title="Issues for this day"
        description="Active findings anchored to this instrument-day."
      >
        <IssueList
          issues={detail.issues}
          from={back.href}
          emptyTitle="No issues recorded"
          emptyDescription="No active finding for this instrument-day."
        />
      </SectionCard>
    </div>
  );
}
