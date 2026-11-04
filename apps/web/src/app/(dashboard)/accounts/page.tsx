import { Suspense } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { Account, AccountAccess, AccountPermission, EquitySnapshot } from '@/lib/types';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { label } from '@/lib/labels';
import { StatCard, StatGrid } from '@/components/dashboard/stat-card';
import { SectionCard } from '@/components/dashboard/section-card';
import { DetailHeader } from '@/components/dashboard/detail-header';
import { DetailSkeleton } from '@/components/dashboard/skeletons';
import { SelectPrompt } from '@/components/dashboard/select-prompt';
import { FormDialog } from '@/components/dashboard/form-dialog';
import { FormField, FormSelect } from '@/components/dashboard/form-field';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
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
import { rotateCredentialAction } from './actions';

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

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const params = await searchParams;
  const accounts = await apiFetch<Account[]>('/accounts');
  const selected = params.account
    ? (accounts.find((account) => account.id === params.account) ?? null)
    : null;

  if (accounts.length === 0) {
    return (
      <EmptyState
        title="No accounts"
        description="Run the R2 seed to create the operator and Upstox account."
      />
    );
  }

  return (
    <div>
      <StatGrid>
        <StatCard
          label="Accounts"
          value={formatNumber(accounts.length)}
          hint="Active broker accounts"
          tone="success"
        />
        <StatCard
          label="Mode"
          value={selected ? label(selected.mode) : '—'}
          hint={selected ? 'Selected account' : 'Select an account'}
          tone="info"
        />
        <StatCard
          label="Tradable instruments"
          value={selected ? formatNumber(selected.permissionCount) : '—'}
          hint="Account-level allowlist"
          tone="highlight"
        />
        <StatCard
          label="Open sessions"
          value={selected ? formatNumber(selected.openSessionCount) : '—'}
          hint="No session opens in R2"
          tone="warning"
        />
      </StatGrid>

      <SectionCard
        className="mt-4"
        title="Account list"
        description="Select an account to load its permissions, equity, access and credentials."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Equity</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Credential expiry</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => {
              const isSelected = selected?.id === account.id;
              return (
                <TableRow key={account.id} data-state={isSelected ? 'selected' : undefined}>
                  <TableCell>
                    <p className="font-medium">{account.code}</p>
                    <p className="text-muted-foreground text-xs">{account.displayName}</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={account.mode} />
                  </TableCell>
                  <TableCell>{account.baseCurrency}</TableCell>
                  <TableCell>
                    {formatMoney(account.latestNetEquity, account.baseCurrency)}
                  </TableCell>
                  <TableCell>{formatNumber(account.permissionCount)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(account.credentialExpiry)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/accounts?account=${account.id}`}
                      className={buttonVariants({
                        variant: isSelected ? 'secondary' : 'outline',
                        size: 'sm',
                      })}
                    >
                      {isSelected ? 'Inspecting' : 'Inspect'}
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </SectionCard>

      {selected ? (
        <Suspense key={selected.id} fallback={<DetailSkeleton blocks={3} className="mt-4" />}>
          <AccountDetail account={selected} />
        </Suspense>
      ) : (
        <SelectPrompt
          className="mt-4"
          title="Select an account to inspect"
          description="Permissions, equity snapshots, access grants and credentials are fetched only after an account is selected."
        />
      )}
    </div>
  );
}

async function AccountDetail({ account }: { account: Account }) {
  const [permissions, access, equity, sessions] = await Promise.all([
    apiFetch<AccountPermission[]>(`/accounts/${account.id}/permissions`),
    apiFetch<AccountAccess[]>(`/accounts/${account.id}/access`),
    apiFetch<EquitySnapshot[]>(`/accounts/${account.id}/equity`),
    apiFetch<TradingSession[]>(`/accounts/${account.id}/sessions`),
  ]);

  return (
    <>
      <DetailHeader
        className="mt-4"
        badges={
          <>
            <StatusBadge status={account.mode} />
            <StatusBadge status={account.isActive ? 'active' : 'inactive'} />
          </>
        }
        meta={`${account.baseCurrency} · UCC ${account.brokerUserRef ?? 'not set'} · opened ${formatDateTime(account.openedAt)}`}
        actions={
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
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <SectionCard
          title="Permissions"
          description="Being in a strategy universe is not enough; the account must also permit the instrument."
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </>
  );
}
