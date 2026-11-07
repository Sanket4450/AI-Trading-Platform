import Link from 'next/link';
import { notFound } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { Account, AccountAccess, AccountPermission, EquitySnapshot } from '@/lib/types';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { PageMeta } from '@/components/shell/page-meta';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { DetailDialog } from '@/components/dashboard/detail-dialog';
import { FormDialog } from '@/components/dashboard/form-dialog';
import { FormField, FormSelect } from '@/components/dashboard/form-field';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import {
  TableActionButton,
  TableActions,
  TableRefreshButton,
} from '@/components/dashboard/table-actions';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { rotateCredentialAction } from '../actions';

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

const credentialTypes = [
  'api_key',
  'api_secret',
  'access_token',
  'refresh_token',
  'totp_secret',
] as const;

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accounts = await apiFetch<Account[]>('/accounts');
  const account = accounts.find((entry) => entry.id === id);

  if (!account) notFound();

  const [permissions, access, equity, sessions] = await Promise.all([
    apiFetch<AccountPermission[]>(`/accounts/${account.id}/permissions`),
    apiFetch<AccountAccess[]>(`/accounts/${account.id}/access`),
    apiFetch<EquitySnapshot[]>(`/accounts/${account.id}/equity`),
    apiFetch<TradingSession[]>(`/accounts/${account.id}/sessions`),
  ]);

  return (
    <div>
      <PageMeta
        title={`${account.displayName} · Account`}
        description="Equity, permissions and trading sessions for this broker account."
      />

      <DetailHeader
        badges={
          <>
            <StatusBadge status={account.mode} />
            <StatusBadge status={account.isActive ? 'active' : 'inactive'} />
          </>
        }
        meta={`${account.baseCurrency} · UCC ${account.brokerUserRef ?? 'not set'} · opened ${formatDateTime(account.openedAt)}`}
        actions={
          <>
            <Link href="/accounts" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Back to accounts
            </Link>
            <FormDialog
              trigger={
                <Button type="button" size="sm" variant="outline">
                  <KeyRound className="size-4" />
                  Rotate credential
                </Button>
              }
              title="Rotate a credential"
              description="The API encrypts with AES-256-GCM and never returns the ciphertext or plaintext."
              submitLabel="Encrypt and store"
              action={rotateCredentialAction}
            >
              <input type="hidden" name="accountId" value={account.id} />
              <input type="hidden" name="providerId" value={account.brokerProviderId} />
              <FormField label="Credential type" htmlFor="credentialType">
                <FormSelect
                  id="credentialType"
                  name="credentialType"
                  defaultValue="access_token"
                  options={credentialTypes.map((type) => ({ value: type, label: label(type) }))}
                />
              </FormField>
              <FormField label="Expires at" htmlFor="expiresAt">
                <Input id="expiresAt" name="expiresAt" type="datetime-local" />
              </FormField>
              <FormField label="Secret value" htmlFor="value">
                <Input id="value" name="value" type="password" placeholder="Write-only" required />
              </FormField>
            </FormDialog>
          </>
        }
      />

      <StatGrid>
        <StatCard
          label="Permissions"
          value={formatNumber(permissions.length)}
          hint="Account-level allowlist"
          tone="info"
        />
        <StatCard
          label="Latest equity"
          value={formatMoney(account.latestNetEquity, account.baseCurrency)}
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
          value={formatNumber(access.length)}
          hint="Operators with explicit access"
          tone="highlight"
        />
      </StatGrid>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <SectionCard
          title="Permissions"
          description="Being in a strategy universe is not enough; the account must also permit the instrument."
          actions={<TableRefreshButton />}
        >
          {permissions.length === 0 ? (
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
                {permissions.slice(0, 30).map((permission) => (
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
                          <Link href={`/instruments/${permission.instrumentId}`}>
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
          >
            {equity.length === 0 ? (
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
                    <TableHead>Net equity</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equity.slice(0, 8).map((snapshot) => (
                    <TableRow key={snapshot.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(snapshot.capturedAt)}
                      </TableCell>
                      <TableCell>{label(snapshot.snapshotType)}</TableCell>
                      <TableCell>{formatMoney(snapshot.netEquity, account.baseCurrency)}</TableCell>
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
                              {
                                label: 'Net equity',
                                value: formatMoney(snapshot.netEquity, account.baseCurrency),
                              },
                              {
                                label: 'Drawdown',
                                value: snapshot.drawdownPct
                                  ? `${(Number(snapshot.drawdownPct) * 100).toFixed(2)}%`
                                  : '—',
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

          <SectionCard title="Access" description="Operators with an explicit grant.">
            {access.length === 0 ? (
              <EmptyState title="No access grants" description="Only the seeded operator exists." />
            ) : (
              <div className="space-y-2">
                {access.map((grant) => (
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
      >
        {sessions.length === 0 ? (
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
              {sessions.map((session) => (
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
