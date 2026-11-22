'use client';

import type { InstrumentCoverageDetail, InstrumentCoverageRow } from '@/lib/types';
import {
  coverageCancelCopy,
  coverageFetchCopy,
  coverageRecomputeCopy,
} from '@/lib/coverage-actions';
import { ConfirmDialog } from '@/components/dashboard/confirm-dialog';
import {
  TableActionButton,
  TableActionLink,
  TableActions,
} from '@/components/dashboard/table-actions';
import { Button } from '@/components/ui/button';
import { useCancelInstrument, useFetchInstruments, useRecomputeStatus } from './mutations';

export function InstrumentRowActions({
  row,
  returnTo,
  viewHref,
}: {
  row: InstrumentCoverageRow;
  returnTo: string;
  viewHref: string;
}) {
  const fetchInstruments = useFetchInstruments();
  const cancelInstrument = useCancelInstrument();
  const fetchCopy = coverageFetchCopy(row);
  const cancelCopy = coverageCancelCopy(row.symbol);
  const fetching = Boolean(row.activeJobId);

  return (
    <TableActions>
      <TableActionLink href={viewHref} label="View instrument" />
      {fetching ? (
        <ConfirmDialog
          trigger={
            <TableActionButton
              icon="cancel"
              tone="destructive"
              label={cancelCopy.label}
              tooltip={cancelCopy.tooltip}
            />
          }
          title={cancelCopy.title}
          description={cancelCopy.description}
          confirmLabel={cancelCopy.label}
          tone="destructive"
          action={cancelInstrument}
          hiddenFields={{ instrumentId: row.instrumentId, returnTo }}
        />
      ) : null}
      {fetchCopy && !fetching ? (
        <ConfirmDialog
          trigger={
            <TableActionButton
              icon="refresh"
              tone="refresh"
              label={fetchCopy.label}
              tooltip={fetchCopy.tooltip}
            />
          }
          title={fetchCopy.title}
          description={fetchCopy.description}
          confirmLabel={fetchCopy.label}
          action={fetchInstruments}
          hiddenFields={{
            instrumentIds: row.instrumentId,
            mode: 'missing_only',
            returnTo,
          }}
        />
      ) : null}
    </TableActions>
  );
}

export function InstrumentDetailActions({
  detail,
  returnTo,
}: {
  detail: InstrumentCoverageDetail;
  returnTo: string;
}) {
  const fetchInstruments = useFetchInstruments();
  const cancelInstrument = useCancelInstrument();
  const recomputeStatus = useRecomputeStatus();
  const fetching = Boolean(detail.activeJobId);
  const fetchCopy = coverageFetchCopy(detail);
  const cancelCopy = coverageCancelCopy(detail.symbol);
  const recomputeCopy = coverageRecomputeCopy(detail.symbol);

  return (
    <>
      <ConfirmDialog
        trigger={
          <Button type="button" size="sm" variant="outline">
            Recompute
          </Button>
        }
        title={recomputeCopy.title}
        description={recomputeCopy.description}
        confirmLabel={recomputeCopy.label}
        action={recomputeStatus}
        hiddenFields={{ instrumentId: detail.instrumentId, returnTo }}
      />
      {fetching ? (
        <ConfirmDialog
          trigger={
            <Button type="button" size="sm" variant="outline">
              Cancel fetch
            </Button>
          }
          title={cancelCopy.title}
          description={cancelCopy.description}
          confirmLabel={cancelCopy.label}
          tone="destructive"
          action={cancelInstrument}
          hiddenFields={{ instrumentId: detail.instrumentId, returnTo }}
        />
      ) : fetchCopy ? (
        <ConfirmDialog
          trigger={
            <Button type="button" size="sm">
              {fetchCopy.label}
            </Button>
          }
          title={fetchCopy.title}
          description={fetchCopy.description}
          confirmLabel={fetchCopy.label}
          action={fetchInstruments}
          hiddenFields={{
            instrumentIds: detail.instrumentId,
            mode: 'missing_only',
            returnTo,
          }}
        />
      ) : null}
    </>
  );
}
