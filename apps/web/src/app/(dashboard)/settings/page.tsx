import { apiFetch } from '@/lib/api';
import type { SystemSetting } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/dashboard/page-header';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateSettingAction } from './actions';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const settings = await apiFetch<SystemSetting[]>('/settings');

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Non-trading system settings. Strategy and risk settings belong in immutable configuration versions."
      />

      {params.error ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-lg border px-4 py-3 text-sm">
          {params.error}
        </div>
      ) : null}
      {params.saved ? (
        <div className="border-primary/30 bg-primary/10 text-primary mb-4 rounded-lg border px-4 py-3 text-sm">
          Setting saved and audited.
        </div>
      ) : null}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="text-muted-foreground p-4 text-sm">
          <span className="text-foreground font-medium">Guardrail:</span> trading mode, risk limits
          and strategy parameters are not editable here. They live in{' '}
          <code className="bg-background rounded px-1 py-0.5">configuration_versions</code> so every
          signal can point at the exact snapshot it used.
        </CardContent>
      </Card>

      <div className="mt-4 space-y-3">
        {settings.length === 0 ? (
          <EmptyState
            title="No settings"
            description="Run the seed to create the default system settings."
          />
        ) : (
          settings.map((setting) => (
            <Card key={setting.key} className="border-border/70 bg-card/60">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="font-mono text-sm">{setting.key}</CardTitle>
                    <CardDescription>{setting.description ?? 'No description'}</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    updated {formatDateTime(setting.updatedAt)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <form
                  action={updateSettingAction}
                  className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]"
                >
                  <input type="hidden" name="key" value={setting.key} />
                  <div className="space-y-1.5">
                    <Label htmlFor={`value-${setting.key}`}>Value (JSON)</Label>
                    <Input
                      id={`value-${setting.key}`}
                      name="value"
                      defaultValue={JSON.stringify(setting.value)}
                      className="font-mono text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`description-${setting.key}`}>Description</Label>
                    <Input
                      id={`description-${setting.key}`}
                      name="description"
                      defaultValue={setting.description ?? ''}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" variant="outline">
                      Save
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
