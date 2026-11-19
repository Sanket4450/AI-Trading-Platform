import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getQualityIssue, recordAudit, transitionQualityIssue } from '@ai-trading/database';
import type { QualityIssueActionDto } from '../dto/quality-issue.dto.js';
import type { RequestMeta } from '../http/request-meta.js';

export type IssueScope = 'instrument' | 'provider';

/**
 * Loads an issue and enforces which surface owns it: instrument issues are read
 * through the instrument routes, provider-wide issues through settings.
 */
export async function loadScopedIssue(id: string, scope: IssueScope) {
  const issue = await getQualityIssue(id);
  const owned =
    scope === 'instrument'
      ? issue && issue.instrumentId !== null
      : issue && issue.instrumentId === null;
  if (!owned) throw new NotFoundException('Quality issue not found');
  return issue;
}

export async function acknowledgeScopedIssue(
  id: string,
  body: QualityIssueActionDto,
  actorUserId: string,
  meta: RequestMeta,
) {
  let updated;
  try {
    updated = await transitionQualityIssue({
      id,
      status: body.status,
      note: body.note ?? null,
      actorUserId,
    });
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : 'Invalid issue transition',
    );
  }
  if (!updated) throw new NotFoundException('Quality issue not found');
  await recordAudit({
    actorUserId,
    accountId: null,
    action: `data_quality_issue.${body.status}`,
    entityType: 'data_quality_issue',
    entityId: id,
    beforeState: null,
    afterState: { status: body.status, note: body.note ?? null },
    requestId: meta.requestId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
  return updated;
}
