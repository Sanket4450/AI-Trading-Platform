import { apiFetch } from '@/lib/api';
import type { Account, AccountSummary, Paginated } from '@/lib/types';
import { formatDateTime, formatNumber } from '@/lib/format';
import { readLimit, readOffset } from '@/lib/pagination';
import { TableCard } from '@/components/dashboard/table-card';
import { TableSummary } from '@/components/dashboard/table-summary';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { EmptyState } from '@/components/dashboard/empty-state';
import { SearchFilter, TableFilters } from '@/components/dashboard/table-filters';
import { TableRefreshButton } from '@/components/dashboard/table-actions';
import { PageSizeSelect } from '@/components/dashboard/page-size-select';
import { Pagination } from '@/components/dashboard/pagination';
import { detailHref, originHref } from '@/lib/navigation';
import {
  TableActionLink,
  TableActions,
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
  searchParams: Promise<{
    search?: string;
    limit?: string | string[];
    offset?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const from = originHref('/accounts', params);
  const limit = readLimit(params.limit);
  const offset = readOffset(params.offset);
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (params.search) query.set('search', params.search);

  const [data, summary] = await Promise.all([
    apiFetch<Paginated<Account>>(`/accounts?${query.toString()}`),
    apiFetch<AccountSummary>(`/accounts/summary?${query.toString()}`),
  ]);
  const accounts = data.items;
  const hasFilters = Boolean(params.search);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TableCard
        summary={
          <TableSummary
            items={[
              {
                label: 'Accounts',
                value: formatNumber(summary.total),
                hint: 'Active broker accounts',
                tone: 'success',
              },
              {
                label: 'Enabled',
                value: formatNumber(summary.active),
                hint: 'Available to strategies',
                tone: 'info',
              },
              {
                label: 'Tradable instruments',
                value: formatNumber(summary.permissionTotal),
                hint: 'Account-level allowlists',
                tone: 'highlight',
              },
              {
                label: 'Credentials tracked',
                value: formatNumber(summary.credentialsTracked),
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
        footer={
          <Pagination
            pageSizeControl={<PageSizeSelect value={limit} />}
            page={data.page}
            itemsCount={accounts.length}
            pathname="/accounts"
            searchParams={params}
            itemLabel="accounts"
          />
        }
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
                  <TableCell>{formatNumber(account.permissionCount)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(account.credentialExpiry)}
                  </TableCell>
                  <TableActions>
                    <TableActionLink
                      href={detailHref(`/accounts/${account.id}`, from)}
                      label="View account"
                    />
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
