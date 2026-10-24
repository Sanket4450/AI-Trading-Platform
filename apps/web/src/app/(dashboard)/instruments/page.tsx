import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { CorporateAction, Instrument, InstrumentMapping } from '@/lib/types';
import { formatDate, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const segments = ['NSE_EQ', 'BSE_EQ', 'NSE_INDEX', 'BSE_INDEX'];

export default async function InstrumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    segment?: string;
    active?: string;
    instrument?: string;
  }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.segment) query.set('segment', params.segment);
  query.set('active', params.active ?? 'true');
  query.set('limit', '500');

  const instruments = await apiFetch<Instrument[]>(`/instruments?${query.toString()}`);
  const selected = instruments.find((instrument) => instrument.id === params.instrument) ?? null;

  const [mappings, corporateActions] = selected
    ? await Promise.all([
        apiFetch<InstrumentMapping[]>(`/instruments/${selected.id}/mappings`),
        apiFetch<CorporateAction[]>(`/instruments/${selected.id}/corporate-actions`),
      ])
    : [[], []];

  return (
    <div>
      <PageHeader
        title="Instruments"
        description="Broker-neutral cash equities and indices. Upstox keys live only in the provider mapping table."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Results"
          value={formatNumber(instruments.length)}
          hint="Filtered instrument master"
          tone="green"
        />
        <StatCard
          label="Equities"
          value={formatNumber(instruments.filter((i) => i.instrumentType === 'EQ').length)}
          hint="Cash segment"
          tone="cyan"
        />
        <StatCard
          label="Indices"
          value={formatNumber(instruments.filter((i) => i.instrumentType === 'INDEX').length)}
          hint="Market confirmation"
          tone="violet"
        />
        <StatCard
          label="Mapped"
          value={formatNumber(instruments.filter((i) => i.mappingCount > 0).length)}
          hint="At least one provider key"
          tone="amber"
        />
      </div>

      <Card className="border-border/70 bg-card/60 mt-6">
        <CardHeader>
          <CardTitle>Search</CardTitle>
          <CardDescription>
            Filter by symbol or name. Select an instrument to inspect its mapping history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                name="search"
                defaultValue={params.search ?? ''}
                placeholder="RELIANCE, NIFTY…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="segment">Segment</Label>
              <select
                id="segment"
                name="segment"
                defaultValue={params.segment ?? ''}
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">All segments</option>
                {segments.map((segment) => (
                  <option key={segment} value={segment}>
                    {segment}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="active">Status</Label>
              <select
                id="active"
                name="active"
                defaultValue={params.active ?? 'true'}
                className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="true">Active only</option>
                <option value="false">Include inactive</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit">Apply</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/60 mt-4">
        <CardHeader>
          <CardTitle>Instrument master</CardTitle>
          <CardDescription>{instruments.length} rows</CardDescription>
        </CardHeader>
        <CardContent>
          {instruments.length === 0 ? (
            <EmptyState
              title="No instruments match"
              description="Clear the filters or run the seed."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>ISIN</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Mappings</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {instruments.map((instrument) => (
                  <TableRow key={instrument.id}>
                    <TableCell className="font-medium">{instrument.tradingSymbol}</TableCell>
                    <TableCell className="text-muted-foreground max-w-64 truncate">
                      {instrument.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {instrument.isin ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{instrument.segment}</Badge>
                    </TableCell>
                    <TableCell>{instrument.instrumentType}</TableCell>
                    <TableCell>{instrument.mappingCount}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/instruments?instrument=${instrument.id}${params.search ? `&search=${encodeURIComponent(params.search)}` : ''}`}
                        className={buttonVariants({ variant: 'outline', size: 'sm' })}
                      >
                        Inspect
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>{selected.tradingSymbol} · provider mappings</CardTitle>
              <CardDescription>
                The canonical UUID never changes; a provider key can be versioned or replaced.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mappings.length === 0 ? (
                <EmptyState
                  title="No mappings"
                  description="Run instrument sync or seed the fixture."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>External key</TableHead>
                      <TableHead>Primary</TableHead>
                      <TableHead>Valid from</TableHead>
                      <TableHead>Valid to</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell>{mapping.providerCode}</TableCell>
                        <TableCell className="font-mono text-xs">{mapping.externalKey}</TableCell>
                        <TableCell>{mapping.isPrimary ? 'yes' : 'no'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(mapping.validFrom)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(mapping.validTo)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle>Corporate actions</CardTitle>
              <CardDescription>
                Adjustments are applied on read; stored candles stay raw.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {corporateActions.length === 0 ? (
                <EmptyState
                  title="No corporate actions"
                  description="Manual or CSV ingest arrives in R1/R2."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Ex-date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Price factor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {corporateActions.map((action) => (
                      <TableRow key={action.id}>
                        <TableCell>{action.actionType}</TableCell>
                        <TableCell>{action.exDate}</TableCell>
                        <TableCell>
                          <StatusBadge status={action.status} />
                        </TableCell>
                        <TableCell>{action.priceAdjustmentFactor}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
