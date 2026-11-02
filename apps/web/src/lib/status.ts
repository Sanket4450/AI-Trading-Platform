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
      return 'border-primary/30 bg-primary/10 text-primary';
    case 'Gaps · reconciled':
      return 'border-[#f5c451]/30 bg-[#f5c451]/10 text-[#f5c451]';
    case 'Verifying':
    case 'Fetching':
    case 'Queued':
      return 'border-[#38d9f5]/30 bg-[#38d9f5]/10 text-[#38d9f5]';
    case 'Failed':
    case 'Stopped':
    case 'Needs review':
    case 'Missing':
    case 'Gaps · mismatch':
      return 'border-[#ff7b7b]/30 bg-[#ff7b7b]/10 text-[#ff7b7b]';
    case 'Stale':
      return 'border-[#f5c451]/30 bg-[#f5c451]/10 text-[#f5c451]';
    default:
      return 'border-muted/30 bg-muted/10 text-muted-foreground';
  }
}
