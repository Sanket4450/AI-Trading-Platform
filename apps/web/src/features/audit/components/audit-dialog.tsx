'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-browser';
import type { AuditDetail, AuditRow } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { formatAction, label } from '@/lib/labels';
import { DetailDialog } from '@/components/dashboard/detail-dialog';
import { JsonBlock } from '@/components/dashboard/json-block';
import { KeyValueGrid } from '@/components/dashboard/key-value-grid';
import { TableActionButton } from '@/components/dashboard/table-actions';

/**
 * List rows omit the before/after state blobs; the canonical entry is read when the dialog opens
 * so a page of audit rows stays small.
 */
export function AuditDialog({ row }: { row: AuditRow }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;

    let active = true;
    apiRequest<AuditDetail>(`/audit/${row.id}`)
      .then((loaded) => {
        if (active) setDetail(loaded);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [open, row.id]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setDetail(null);
      setFailed(false);
    }
  }

  const entry = detail ?? row;

  return (
    <DetailDialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={<TableActionButton label="View audit entry" />}
      title={formatAction(row.action)}
      description={formatDateTime(row.createdAt)}
    >
      {failed ? (
        <p className="text-muted-foreground text-sm">
          This audit entry could not be loaded.
        </p>
      ) : (
        <>
          <KeyValueGrid
            columns={2}
            items={[
              { label: 'Actor', value: entry.actorEmail ?? 'System' },
              {
                label: 'Actor user ID',
                value: (
                  <span className="break-all font-mono text-xs">
                    {entry.actorUserId ?? '—'}
                  </span>
                ),
              },
              { label: 'Action', value: entry.action },
              { label: 'Entity', value: label(entry.entityType) },
              {
                label: 'Entity ID',
                value: (
                  <span className="break-all font-mono text-xs">{entry.entityId ?? '—'}</span>
                ),
              },
              { label: 'IP address', value: entry.ipAddress ?? '—' },
              {
                label: 'Request ID',
                value: (
                  <span className="break-all font-mono text-xs">{entry.requestId ?? '—'}</span>
                ),
              },
              { label: 'Recorded', value: formatDateTime(entry.createdAt) },
            ]}
          />
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">Before</p>
            <JsonBlock value={detail?.beforeState ?? null} />
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">After</p>
            <JsonBlock value={detail?.afterState ?? null} />
          </div>
        </>
      )}
    </DetailDialog>
  );
}
