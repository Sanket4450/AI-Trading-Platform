'use client';

import { useState } from 'react';
import { LoaderCircle } from 'lucide-react';
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
  const [fetchPending, setFetchPending] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const fetchCopy = coverageFetchCopy(row);
  const cancelCopy = coverageCancelCopy(row.symbol);
  const fetching = Boolean(row.activeJobId);

  const runFetch = async (formData: FormData) => {
    setFetchPending(true);
    try {
      await fetchInstruments(formData);
    } finally {
      setFetchPending(false);
    }
  };

  const runCancel = async (formData: FormData) => {
    setCancelPending(true);
    try {
      await cancelInstrument(formData);
    } finally {
      setCancelPending(false);
    }
  };

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
              pending={cancelPending}
            />
          }
          title={cancelCopy.title}
          description={cancelCopy.description}
          confirmLabel={cancelCopy.label}
          tone="destructive"
          action={runCancel}
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
              pending={fetchPending}
            />
          }
          title={fetchCopy.title}
          description={fetchCopy.description}
          confirmLabel={fetchCopy.label}
          action={runFetch}
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
  const [fetchPending, setFetchPending] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [recomputePending, setRecomputePending] = useState(false);
  const fetching = Boolean(detail.activeJobId);
  const recomputing = Boolean(detail.activeRecomputeJobId);
  const fetchCopy = coverageFetchCopy(detail);
  const cancelCopy = coverageCancelCopy(detail.symbol);
  const recomputeCopy = coverageRecomputeCopy(detail.symbol);

  const runFetch = async (formData: FormData) => {
    setFetchPending(true);
    try {
      await fetchInstruments(formData);
    } finally {
      setFetchPending(false);
    }
  };

  const runCancel = async (formData: FormData) => {
    setCancelPending(true);
    try {
      await cancelInstrument(formData);
    } finally {
      setCancelPending(false);
    }
  };

  const runRecompute = async (formData: FormData) => {
    setRecomputePending(true);
    try {
      await recomputeStatus(formData);
    } finally {
      setRecomputePending(false);
    }
  };

  return (
    <>
      {recomputing || recomputePending ? (
        <Button type="button" size="sm" variant="outline" disabled aria-busy>
          <LoaderCircle className="size-3.5 animate-spin" />
          Recomputing…
        </Button>
      ) : (
        <ConfirmDialog
          trigger={
            <Button type="button" size="sm" variant="outline">
              Recompute
            </Button>
          }
          title={recomputeCopy.title}
          description={recomputeCopy.description}
          confirmLabel={recomputeCopy.label}
          action={runRecompute}
          hiddenFields={{ instrumentId: detail.instrumentId, returnTo }}
        />
      )}
      {fetching ? (
        <ConfirmDialog
          trigger={
            <Button type="button" size="sm" variant="outline" disabled={cancelPending}>
              {cancelPending ? (
                <>
                  <LoaderCircle className="size-3.5 animate-spin" />
                  Cancelling…
                </>
              ) : (
                'Cancel fetch'
              )}
            </Button>
          }
          title={cancelCopy.title}
          description={cancelCopy.description}
          confirmLabel={cancelCopy.label}
          tone="destructive"
          action={runCancel}
          hiddenFields={{ instrumentId: detail.instrumentId, returnTo }}
        />
      ) : fetchPending ? (
        <Button type="button" size="sm" disabled aria-busy>
          <LoaderCircle className="size-3.5 animate-spin" />
          Queueing fetch…
        </Button>
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
          action={runFetch}
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
