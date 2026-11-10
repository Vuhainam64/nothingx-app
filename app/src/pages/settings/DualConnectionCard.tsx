import { useTranslation } from 'react-i18next';
import { Laptop, Smartphone, Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { StatusChip } from '@/components/StatusChip';
import { useDeviceStore, useCapabilities } from '@/lib/deviceStore';

export function DualConnectionCard() {
  const { t } = useTranslation();
  const caps = useCapabilities();
  const dualConnection = useDeviceStore((s) => s.dualConnection);
  const setDualConnection = useDeviceStore((s) => s.setDualConnection);
  const connectionMode = useDeviceStore((s) => s.connectionMode);

  if (!caps.dualConnection) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-primary/12 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <Link2 className="size-4" />
          </div>
          <div>
            <CardTitle>{t('settings.dualConnection')}</CardTitle>
            <CardDescription className="mt-1">{t('settings.dualConnectionDesc')}</CardDescription>
          </div>
        </div>
        <Switch checked={dualConnection} onCheckedChange={setDualConnection} />
      </CardHeader>

      {dualConnection && (
        <CardContent className="pt-0 space-y-2.5">
          <div className="text-xs font-medium text-muted-foreground">
            {t('settings.pairedDevices')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Laptop className="size-4 text-primary" />
                <span className="text-sm font-medium">{t('settings.thisComputer')}</span>
              </div>
              {connectionMode === 'connected' && (
                <StatusChip tone="success">{t('header.connected')}</StatusChip>
              )}
            </div>
            <div className="p-3.5 rounded-xl border border-dashed border-border/60 flex items-center gap-2.5 text-xs text-muted-foreground">
              <Smartphone className="size-4 shrink-0" />
              <span>{t('settings.otherDevicesUnknown')}</span>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
