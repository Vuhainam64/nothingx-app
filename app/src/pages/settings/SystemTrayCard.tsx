import { useTranslation } from 'react-i18next';
import { Minimize2, EyeOff, Pin } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useDeviceStore } from '@/lib/deviceStore';

export function SystemTrayCard() {
  const { t } = useTranslation();
  const closeToTray = useDeviceStore((s) => s.closeToTray);
  const alwaysOnTopMini = useDeviceStore((s) => s.alwaysOnTopMini);
  const setCloseToTray = useDeviceStore((s) => s.setCloseToTray);
  const setAlwaysOnTopMini = useDeviceStore((s) => s.setAlwaysOnTopMini);
  const setViewMode = useDeviceStore((s) => s.setViewMode);
  const hideToSystemTray = useDeviceStore((s) => s.hideToSystemTray);

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Minimize2 className="size-4 text-primary" />
            {t('tray.cardTitle')}
          </CardTitle>
          <CardDescription className="mt-1">{t('tray.cardDesc')}</CardDescription>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setViewMode('mini');
              toast.success(t('tray.pinnedToast'));
            }}
            className="gap-1.5"
          >
            <Minimize2 className="size-3.5" />
            {t('tray.switchMiniBtn')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              await hideToSystemTray();
              toast.info(t('tray.hiddenToast'));
            }}
            className="gap-1.5"
          >
            <EyeOff className="size-3.5" />
            {t('tray.hideTrayBtn')}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-0">
        <div className="p-4 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">{t('tray.closeToTray')}</div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              {t('tray.closeToTrayDesc')}
            </div>
          </div>
          <Switch checked={closeToTray} onCheckedChange={setCloseToTray} />
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <Pin className="size-3.5 text-primary" />
              {t('tray.alwaysOnTop')}
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              {t('tray.alwaysOnTopDesc')}
            </div>
          </div>
          <Switch checked={alwaysOnTopMini} onCheckedChange={setAlwaysOnTopMini} />
        </div>
      </CardContent>
    </Card>
  );
}
