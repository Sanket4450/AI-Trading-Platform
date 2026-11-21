import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { ApiError } from '@/lib/api-error';
import type {
  Account,
  AccountAccess,
  AccountPermission,
  EquitySnapshot,
  Paginated,
} from '@/lib/types';
import { PAGINATION_DEFAULT_LIMIT } from '@ai-trading/domain';
import { readCursorValue, readOffset } from '@/lib/pagination';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { backLinkFor, detailHref } from '@/lib/navigation';
import { PageMeta } from '@/components/shell/page-meta';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { DetailDialog } from '@/components/dashboard/detail-dialog';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import {
  TableActionButton,
  TableActions,
  TableRefreshButton,
} from '@/components/dashboard/table-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pagination } from '@/components/dashboard/pagination';
import { RotateCredentialDialog } from './rotate-credential-dialog';

interface TradingSession {
  id: string;
  tradingDate: string;
  mode: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  openingEquity: string | null;
  closingEquity: string | null;
  killSwitchEngaged: boolean;
}

export default async function AccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    from?: string | string[];
    permissionsOffset?: string | string[];
    accessOffset?: string | string[];
    equityAfter?: string | string[];
    equityBefore?: string | string[];
    sessionsAfter?: string | string[];
    sessionsBefore?: string | string[];
  }>;
}) {
  const { id } = await params;
  const queryParams = await searchParams;
  const fromParam = queryParams.from;
  const back = backLinkFor(fromParam, '/accounts');
  const account = await apiFetch<Account>(`/accounts/${id}`).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });

  if (!account) notFound();

  const permissionsOffset = readOffset(queryParams.permissionsOffset);
  const accessOffset = readOffset(queryParams.accessOffset);
  const equityAfter = readCursorValue(queryParams.equityAfter);
  const equityBefore = readCursorValue(queryParams.equityBefore);
  const sessionsAfter = readCursorValue(queryParams.sessionsAfter);
  const sessionsBefore = readCursorValue(queryParams.sessionsBefore);

  const equityQuery = new URLSearchParams({ limit: String(PAGINATION_DEFAULT_LIMIT) });
  if (equityAfter) equityQuery.set('after', equityAfter);
  if (equityBefore) equityQuery.set('before', equityBefore);
  const sessionsQuery = new URLSearchParams({ limit: String(PAGINATION_DEFAULT_LIMIT) });
  if (sessionsAfter) sessionsQuery.set('after', sessionsAfter);
  if (sessionsBefore) sessionsQuery.set('before', sessionsBefore);

  const [permissions, access, equity, sessions] = await Promise.all([
    apiFetch<Paginated<AccountPermission>>(
      `/accounts/${account.id}/permissions?limit=${PAGINATION_DEFAULT_LIMIT}&offset=${permissionsOffset}`,
    ),
    apiFetch<Paginated<AccountAccess>>(
      `/accounts/${account.id}/access?limit=${PAGINATION_DEFAULT_LIMIT}&offset=${accessOffset}`,
    ),
    apiFetch<Paginated<EquitySnapshot>>(
      `/accounts/${account.id}/equity?${equityQuery.toString()}`,
    ),
    apiFetch<Paginated<TradingSession>>(
      `/accounts/${account.id}/sessions?${sessionsQuery.toString()}`,
    ),
  ]);

  return (
    <div>
      <PageMeta
        title={`${account.displayName} · Account`}
        description="Equity, permissions and trading sessions for this broker account."
      />

      <DetailHeader
        back={back}
        badges={
          <>
            <StatusBadge status={account.mode} />
            <StatusBadge status={account.isActive ? 'active' : 'inactive'} />
          </>
        }
        meta={`${account.baseCurrency} · UCC ${account.brokerUserRef ?? 'not set'} · opened ${formatDateTime(account.openedAt)}`}
        actions={
          <RotateCredentialDialog
            accountId={account.id}
            providerId={account.brokerProviderId}
          />
        }
      />

      <StatGrid>
        <StatCard
          label="Permissions"
          value={formatNumber(permissions.page.total)}
          hint="Account-level allowlist"
          tone="info"
        />
        <StatCard
          label="Equity snapshots"
          value={formatNumber(equity.page.total)}
          hint={formatDateTime(account.latestEquityAt)}
          tone="success"
        />
        <StatCard
          label="Open sessions"
          value={formatNumber(account.openSessionCount)}
          hint="No session opens in R2"
          tone="warning"
        />
        <StatCard
          label="Access grants"
          value={formatNumber(access.page.total)}
          hint="Operators with explicit access"
          tone="highlight"
        />
      </StatGrid>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <SectionCard
          title="Permissions"
          description="Being a sync target is not enough; the account must also permit the instrument."
          actions={<TableRefreshButton />}
          footer={
            <Pagination
              page={permissions.page}
              itemsCount={permissions.items.length}
              pathname={`/accounts/${account.id}`}
              searchParams={queryParams}
              itemLabel="permissions"
              names={{ offset: 'permissionsOffset' }}
            />
          }
        >
          {permissions.items.length === 0 ? (
            <EmptyState
              title="No permissions"
              description="Seed or add account-instrument permissions."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Tradable</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.items.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell>
                      <p className="font-medium">{permission.symbol}</p>
                      <p className="text-muted-foreground text-xs">{permission.name}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={permission.isTradable ? 'active' : 'failed'} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {permission.productAllowlist.map((product) => label(product)).join(', ')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {permission.effectiveFrom} → {permission.effectiveTo ?? 'open'}
                    </TableCell>
                    <TableActions>
                      <DetailDialog
                        title={`${permission.symbol} · permission`}
                        description={permission.name}
                        trigger={
                          <TableActionButton label={`View ${permission.symbol} permission`} />
                        }
                      >
                        <KeyValueGrid
                          columns={2}
                          items={[
                            { label: 'Symbol', value: permission.symbol },
                            { label: 'Name', value: permission.name },
                            {
                              label: 'Instrument ID',
                              value: (
                                <span className="break-all font-mono text-xs">
                                  {permission.instrumentId}
                                </span>
                              ),
                            },
                            {
                              label: 'Tradable',
                              value: permission.isTradable ? 'Yes' : 'No',
                            },
                            {
                              label: 'Products',
                              value: permission.productAllowlist
                                .map((product) => label(product))
                                .join(', '),
                            },
                            {
                              label: 'Effective',
                              value: `${permission.effectiveFrom} → ${permission.effectiveTo ?? 'open'}`,
                            },
                          ]}
                        />
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={detailHref(`/instruments/${permission.instrumentId}`, back.href)}
                          >
                            Open instrument
                          </Link>
                        </Button>
                      </DetailDialog>
                    </TableActions>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            title="Equity snapshots"
            description="Session-open equity is the daily-loss baseline."
            actions={<TableRefreshButton />}
            footer={
              <Pagination
                page={equity.page}
                itemsCount={equity.items.length}
                pathname={`/accounts/${account.id}`}
                searchParams={queryParams}
                itemLabel="snapshots"
                names={{ after: 'equityAfter', before: 'equityBefore' }}
              />
            }
          >
            {equity.items.length === 0 ? (
              <EmptyState
                title="No equity snapshots"
                description="Broker sync arrives in a later release."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Captured</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equity.items.map((snapshot) => (
                    <TableRow key={snapshot.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(snapshot.capturedAt)}
                      </TableCell>
                      <TableCell>{label(snapshot.snapshotType)}</TableCell>
                      <TableActions>
                        <DetailDialog
                          title={`Equity snapshot · ${snapshot.tradingDate}`}
                          description={formatDateTime(snapshot.capturedAt)}
                          trigger={<TableActionButton label="View equity snapshot" />}
                        >
                          <KeyValueGrid
                            columns={2}
                            items={[
                              { label: 'Trading date', value: snapshot.tradingDate },
                              { label: 'Captured', value: formatDateTime(snapshot.capturedAt) },
                              { label: 'Type', value: label(snapshot.snapshotType) },
                              { label: 'Source', value: label(snapshot.source) },
                              {
                                label: 'Available cash',
                                value: formatMoney(snapshot.availableCash, account.baseCurrency),
                              },
                            ]}
                          />
                        </DetailDialog>
                      </TableActions>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>

          <SectionCard
            title="Access"
            description="Operators with an explicit grant."
            footer={
              <Pagination
                page={access.page}
                itemsCount={access.items.length}
                pathname={`/accounts/${account.id}`}
                searchParams={queryParams}
                itemLabel="grants"
                names={{ offset: 'accessOffset' }}
              />
            }
          >
            {access.items.length === 0 ? (
              <EmptyState title="No access grants" description="Only the seeded operator exists." />
            ) : (
              <div className="space-y-2">
                {access.items.map((grant) => (
                  <div
                    key={grant.id}
                    className="border-border/70 bg-background/40 flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{grant.displayName}</p>
                      <p className="text-muted-foreground text-xs">{grant.email}</p>
                    </div>
                    <Badge variant="outline">{label(grant.role)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard
        className="mt-4"
        title="Trading sessions"
        description="No session is opened while the platform runs in research mode; the table is ready for R5."
        actions={<TableRefreshButton />}
        footer={
          <Pagination
            page={sessions.page}
            itemsCount={sessions.items.length}
            pathname={`/accounts/${account.id}`}
            searchParams={queryParams}
            itemLabel="sessions"
            names={{ after: 'sessionsAfter', before: 'sessionsBefore' }}
          />
        }
      >
        {sessions.items.length === 0 ? (
          <EmptyState
            title="No sessions"
            description="Research mode does not open a trading session."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Kill switch</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.items.map((session) => (
                <TableRow key={session.id}>
                  <TableCell>{session.tradingDate}</TableCell>
                  <TableCell>{label(session.mode)}</TableCell>
                  <TableCell>
                    <StatusBadge status={session.status} />
                  </TableCell>
                  <TableCell>{session.killSwitchEngaged ? 'Engaged' : 'Clear'}</TableCell>
                  <TableActions>
                    <DetailDialog
                      title={`Session · ${session.tradingDate}`}
                      description={label(session.mode)}
                      trigger={<TableActionButton label="View session" />}
                    >
                      <KeyValueGrid
                        columns={2}
                        items={[
                          { label: 'Trading date', value: session.tradingDate },
                          { label: 'Mode', value: label(session.mode) },
                          { label: 'Status', value: label(session.status) },
                          {
                            label: 'Started',
                            value: formatDateTime(session.startedAt),
                          },
                          {
                            label: 'Ended',
                            value: formatDateTime(session.endedAt),
                          },
                          {
                            label: 'Opening equity',
                            value: formatMoney(session.openingEquity, account.baseCurrency),
                          },
                          {
                            label: 'Closing equity',
                            value: formatMoney(session.closingEquity, account.baseCurrency),
                          },
                          {
                            label: 'Kill switch',
                            value: session.killSwitchEngaged ? 'Engaged' : 'Clear',
                          },
                        ]}
                      />
                    </DetailDialog>
                  </TableActions>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
