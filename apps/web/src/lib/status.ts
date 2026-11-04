export function displayStatus(input: {
  fetchStatus: string | null;
  dataStatus: string | null;
  lastSuccessAt: string | null;
  computedAt: string | null;
}): string {
  const fetchStatus = input.fetchStatus;
  const dataStatus = input.dataStatus;
  if (fetchStatus === 'failed') return 'Failed';
  if (fetchStatus === 'cancelled') return 'Stopped';
  if (fetchStatus === 'fetching') return 'Fetching';
  if (fetchStatus === 'queued') return 'Queued';
  if (
    dataStatus === 'pending' ||
    (input.lastSuccessAt &&
      input.computedAt &&
      new Date(input.lastSuccessAt) > new Date(input.computedAt))
  ) {
    return 'Verifying';
  }
  if (dataStatus === 'needs_review') return 'Needs review';
  if (dataStatus === 'missing') return 'Missing';
  if (dataStatus === 'partial_mismatch') return 'Gaps · mismatch';
  if (fetchStatus === 'stale') return 'Stale';
  if (dataStatus === 'partial_reconciled') return 'Gaps · reconciled';
  if (dataStatus === 'not_applicable') return 'Not applicable';
  if (dataStatus === 'complete') return 'Complete';
  return 'Not fetched';
}

export function statusTone(status: string): string {
  switch (status) {
    case 'Complete':
      return 'border-success/30 bg-success/10 text-success';
    case 'Gaps · reconciled':
      return 'border-warning/30 bg-warning/10 text-warning-strong';
    case 'Verifying':
    case 'Fetching':
    case 'Queued':
      return 'border-info/30 bg-info/10 text-info';
    case 'Failed':
    case 'Stopped':
    case 'Needs review':
    case 'Missing':
    case 'Gaps · mismatch':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    case 'Stale':
      return 'border-warning/30 bg-warning/10 text-warning-strong';
    default:
      return 'border-muted/30 bg-muted/10 text-muted-foreground';
  }
}
