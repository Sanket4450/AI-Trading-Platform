import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { CoverageRow, QualityIssue } from '@/lib/types';
import { formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { backLinkFor, detailHref, type DetailSearchParams } from '@/lib/navigation';
import { PageMeta } from '@/components/shell/page-meta';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { JsonBlock } from '@/components/dashboard/json-block';

interface DayDetail {
  instrument: { id: string; symbol: string; name: string; segment?: string; tickSize: string } | null;
  coverage: CoverageRow | null;
  issues: QualityIssue[];
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

      <StatGrid columns={4}>
        <StatCard
          label="Expected"
          value={formatNumber(coverage?.expectedBars ?? 0)}
          hint="Session minutes"
          tone="info"
        />
        <StatCard
          label="Stored"
          value={formatNumber(coverage?.storedBars ?? 0)}
          hint="Distinct 1-minute rows"
          tone="success"
        />
        <StatCard
          label="Gaps"
          value={formatNumber(coverage?.gapCount ?? 0)}
          hint="Missing minutes"
          tone="warning"
        />
        <StatCard
          label="Gap runs"
          value={formatNumber(coverage?.gapRunCount ?? 0)}
          hint={`Longest ${coverage?.maxGapMinutes ?? 0}m`}
          tone="highlight"
        />
      </StatGrid>

      <SectionCard
        className="mt-4"
        title="Evidence"
        description="Gap starts and raw payload lineage."
        contentClassName="space-y-4"
      >
        {coverage ? <JsonBlock value={coverage.details} /> : null}
        <div>
          <h3 className="mb-2 text-sm font-medium">Issues for this day</h3>
          {detail.issues.length === 0 ? (
            <p className="text-muted-foreground text-sm">No issues recorded.</p>
          ) : (
            <div className="space-y-2">
              {detail.issues.map((issue) => (
                <Link
                  key={issue.id}
                  href={detailHref(`/instruments/issues/${issue.id}`, back.href)}
                  className="border-border/70 bg-background/40 block rounded-lg border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{label(issue.issueType)}</span>
                    <StatusBadge status={issue.severity} />
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {issue.ruleId ?? 'No rule'} · {label(issue.status)} · seen {issue.occurrenceCount}×
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
