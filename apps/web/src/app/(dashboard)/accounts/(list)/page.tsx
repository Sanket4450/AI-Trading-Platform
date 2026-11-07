import { apiFetch } from '@/lib/api';
import type { Account } from '@/lib/types';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import { TableCard } from '@/components/dashboard/table-card';
import { TableSummary } from '@/components/dashboard/table-summary';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { SearchFilter, TableFilters } from '@/components/dashboard/table-filters';
import {
  TableActionLink,
  TableActions,
  TableRefreshButton,
} from '@/components/dashboard/table-actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  const queryString = query.toString();

  const accounts = await apiFetch<Account[]>(`/accounts${queryString ? `?${queryString}` : ''}`);

  const activeAccounts = accounts.filter((account) => account.isActive).length;
  const permissionTotal = accounts.reduce((total, account) => total + account.permissionCount, 0);
  const credentialsTracked = accounts.filter((account) => account.credentialExpiry).length;
  const hasFilters = Boolean(params.search);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TableCard
        summary={
          <TableSummary
            items={[
              {
                label: 'Accounts',
                value: formatNumber(accounts.length),
                hint: 'Active broker accounts',
                tone: 'success',
              },
              {
                label: 'Enabled',
                value: formatNumber(activeAccounts),
                hint: 'Available to strategies',
                tone: 'info',
              },
              {
                label: 'Tradable instruments',
                value: formatNumber(permissionTotal),
                hint: 'Account-level allowlists',
                tone: 'highlight',
              },
              {
                label: 'Credentials tracked',
                value: formatNumber(credentialsTracked),
                hint: 'Expiry recorded',
                tone: 'warning',
              },
            ]}
          />
        }
        filters={
          <TableFilters>
            <SearchFilter defaultValue={params.search ?? ''} placeholder="Search code or name…" />
          </TableFilters>
        }
        actions={<TableRefreshButton />}
      >
        {accounts.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No accounts"
              description={
                hasFilters
                  ? 'No account matches this search.'
                  : 'Run the R2 seed to create the operator and Upstox account.'
              }
            />
          </div>
        ) : (
          <Table containerClassName="h-full overflow-auto">
            <TableHeader className="bg-card sticky top-0 z-10">
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
                  <TableActions>
                    <TableActionLink href={`/accounts/${account.id}`} label="View account" />
                  </TableActions>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>
    </div>
  );
}
