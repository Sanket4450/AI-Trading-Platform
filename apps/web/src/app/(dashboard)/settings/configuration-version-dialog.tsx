'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import type { ConfigurationVersion } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { label } from '@/lib/labels';
import { FormDialog } from '@/components/dashboard/form-dialog';
import { FormField, FormSelect } from '@/components/dashboard/form-field';
import { JsonBlock } from '@/components/dashboard/json-block';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { bindConfigurationAction } from './actions';

const bindingRoles = ['parameters', 'risk', 'execution'] as const;

/**
 * Read-only snapshot viewer that also hosts the bind-to-strategy write. It is opened by the
 * `?version=` query so a strategy binding can deep-link straight to its configuration.
 */
export function ConfigurationVersionDialog({
  version,
  defaultOpen = false,
}: {
  version: ConfigurationVersion;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(defaultOpen);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next || !defaultOpen) return;

    const params = new URLSearchParams(window.location.search);
    params.delete('version');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {label(version.configType)} · {version.scopeKey} v{version.version}
          </DialogTitle>
          <DialogDescription>
            Immutable configuration snapshot. Create a new version to change the payload.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{label(version.configType)}</Badge>
            <Badge variant="outline">v{version.version}</Badge>
            <Badge variant="outline" className="font-mono text-[10px]">
              {version.payloadHash.slice(0, 12)}…
            </Badge>
          </div>

          <KeyValueGrid
            columns={2}
            items={[
              { label: 'Scope', value: version.scopeKey },
              { label: 'Schema version', value: version.schemaVersion },
              {
                label: 'Payload hash',
                value: <span className="break-all font-mono text-xs">{version.payloadHash}</span>,
              },
              { label: 'Created', value: formatDateTime(version.createdAt) },
              { label: 'Effective from', value: formatDateTime(version.effectiveFrom) },
              {
                label: 'Effective to',
                value: version.effectiveTo ? formatDateTime(version.effectiveTo) : 'Open ended',
              },
              {
                label: 'Supersedes',
                value: version.supersedesId ? (
                  <span className="break-all font-mono text-xs">{version.supersedesId}</span>
                ) : (
                  'None'
                ),
              },
              {
                label: 'Created by',
                value: version.createdBy ? (
                  <span className="break-all font-mono text-xs">{version.createdBy}</span>
                ) : (
                  '—'
                ),
              },
            ]}
          />

          <div>
            <h3 className="mb-2 text-sm font-medium">Payload</h3>
            <JsonBlock value={version.payload} />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Bindings</h3>
              <FormDialog
                trigger={
                  <Button type="button" size="sm" variant="outline">
                    <SlidersHorizontal className="size-4" />
                    Bind to strategy
                  </Button>
                }
                title="Bind to a strategy version"
                description="Binding is the only path from a snapshot to a strategy."
                submitLabel="Bind"
                action={bindConfigurationAction}
              >
                <input type="hidden" name="configurationId" value={version.id} />
                <FormField
                  label="Strategy version ID"
                  htmlFor={`strategyVersionId-${version.id}`}
                  hint="Copy the UUID from the strategy detail page."
                >
                  <Input
                    id={`strategyVersionId-${version.id}`}
                    name="strategyVersionId"
                    placeholder="UUID"
                    required
                  />
                </FormField>
                <FormField label="Role" htmlFor={`role-${version.id}`}>
                  <FormSelect
                    id={`role-${version.id}`}
                    name="role"
                    defaultValue="parameters"
                    options={bindingRoles.map((role) => ({ value: role, label: label(role) }))}
                  />
                </FormField>
              </FormDialog>
            </div>

            {!version.bindings || version.bindings.length === 0 ? (
              <EmptyState
                title="Not bound"
                description="Bind this snapshot to a strategy version."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Bound at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {version.bindings.map((binding) => (
                    <TableRow key={binding.id}>
                      <TableCell>{binding.strategyCode}</TableCell>
                      <TableCell>v{binding.strategyVersion}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{label(binding.role)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(binding.boundAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
