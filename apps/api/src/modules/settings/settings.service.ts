import { Injectable } from '@nestjs/common';
import {
  listSystemSettings,
  recordAudit,
  upsertSystemSetting,
} from '@ai-trading/database';
import type { RequestMeta } from '../../common/http/request-meta.js';
import type { UpdateSettingDto } from './dto/update-setting.dto.js';

@Injectable()
export class SettingsService {
  list() {
    return listSystemSettings();
  }

  async update(
    key: string,
    body: UpdateSettingDto,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    const before =
      (await listSystemSettings()).find((setting) => setting.key === key) ??
      null;
    const updated = await upsertSystemSetting({
      key,
      value: body.value,
      description: body.description ?? before?.description ?? null,
      updatedBy: actorUserId,
    });

    await recordAudit({
      actorUserId,
      accountId: null,
      action: 'system_setting.updated',
      entityType: 'system_setting',
      entityId: null,
      beforeState: before
        ? { value: before.value, description: before.description }
        : null,
      afterState: {
        key,
        value: updated.value,
        description: updated.description,
      },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
