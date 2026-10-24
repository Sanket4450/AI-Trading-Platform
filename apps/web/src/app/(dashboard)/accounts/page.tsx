import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { Account, AccountAccess, AccountPermission, EquitySnapshot } from '@/lib/types';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
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

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const params = await searchParams;
  const accounts = await apiFetch<Account[]>('/accounts');
  const selected = accounts.find((account) => account.id === params.account) ?? accounts[0] ?? null;

  const [permissions, access, equity, sessions] = selected
    ? await Promise.all([
        apiFetch<AccountPermission[]>(`/accounts/${selected.id}/permissions`),
        apiFetch<AccountAccess[]>(`/accounts/${selected.id}/access`),
        apiFetch<EquitySnapshot[]>(`/accounts/${selected.id}/equity`),
        apiFetch<TradingSession[]>(`/accounts/${selected.id}/sessions`),
      ])
    : [[], [], [], []];

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Broker accounts, mode, equity baseline, tradable instruments and credential references. Secrets are write-only."
      />

      {accounts.length === 0 ? (
        <EmptyState
          title="No accounts"
          description="Run the seed to create the R1 operator and Upstox account."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Accounts"
              value={formatNumber(accounts.length)}
              hint="One active in R1"
              tone="green"
            />
            <StatCard
              label="Mode"
              value={selected?.mode.toUpperCase() ?? '—'}
              hint="Every active account must be offline"
              tone="cyan"
            />
            <StatCard
              label="Tradable instruments"
              value={formatNumber(selected?.permissionCount ?? 0)}
              hint="Account-level allowlist"
              tone="violet"
            />
            <StatCard
              label="Open sessions"
              value={formatNumber(selected?.openSessionCount ?? 0)}
              hint="No session is opened in R1"
              tone="amber"
            />
          </div>

          <Card className="border-border/70 bg-card/60 mt-6">
            <CardHeader>
              <CardTitle>Account list</CardTitle>
              <CardDescription>
                Select an account to inspect its permissions, equity and access.
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
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
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                        >
                          Inspect
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {selected ? (
            <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
              <Card className="border-border/70 bg-card/60">
                <CardHeader>
                  <CardTitle>{selected.code} · permissions</CardTitle>
                  <CardDescription>
                    Being in a strategy universe is not enough; the account must also permit the
                    instrument.
                  </CardDescription>
                </CardHeader>
                <CardContent>
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
                              {permission.productAllowlist.join(', ')}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {permission.effectiveFrom} → {permission.effectiveTo ?? 'open'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="border-border/70 bg-card/60">
                  <CardHeader>
                    <CardTitle>Equity snapshots</CardTitle>
                    <CardDescription>
                      Session-open equity is the daily-loss baseline.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
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
                              <TableCell>{snapshot.snapshotType}</TableCell>
                              <TableCell>
                                {formatMoney(snapshot.netEquity, selected.baseCurrency)}
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
                    <CardTitle>Access</CardTitle>
                    <CardDescription>Operators with an explicit grant.</CardDescription>
                  </CardHeader>
                  <CardContent>
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
                          <Badge variant="outline">{grant.role}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}

          {selected ? (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <Card className="border-border/70 bg-card/60">
                <CardHeader>
                  <CardTitle>Rotate a credential</CardTitle>
                  <CardDescription>
                    The API encrypts with AES-256-GCM and never returns the ciphertext or plaintext.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={rotateCredentialAction} className="grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="accountId" value={selected.id} />
                    <input type="hidden" name="providerId" value={selected.brokerProviderId} />
                    <div className="space-y-1.5">
                      <Label htmlFor="credentialType">Credential type</Label>
                      <select
                        id="credentialType"
                        name="credentialType"
                        className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                        defaultValue="access_token"
                      >
                        <option value="api_key">api_key</option>
                        <option value="api_secret">api_secret</option>
                        <option value="access_token">access_token</option>
                        <option value="refresh_token">refresh_token</option>
                        <option value="totp_secret">totp_secret</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="expiresAt">Expires at</Label>
                      <Input id="expiresAt" name="expiresAt" type="datetime-local" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="value">Secret value</Label>
                      <Input
                        id="value"
                        name="value"
                        type="password"
                        placeholder="Write-only"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Button type="submit">Encrypt and store</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/60">
                <CardHeader>
                  <CardTitle>Trading sessions</CardTitle>
                  <CardDescription>
                    No session is opened in R1; the table is ready for R5.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {sessions.length === 0 ? (
                    <EmptyState
                      title="No sessions"
                      description="R1 remains offline and does not open a trading session."
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
                            <TableCell>{session.mode}</TableCell>
                            <TableCell>
                              <StatusBadge status={session.status} />
                            </TableCell>
                            <TableCell>{session.killSwitchEngaged ? 'engaged' : 'clear'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
