import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, FlaskConical, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/StatusChip';
import { useDeviceStore } from '@/lib/deviceStore';

export function EarFitTestCard() {
  const { t } = useTranslation();
  const earFitRunning = useDeviceStore((s) => s.earFitRunning);
  const earFitResult = useDeviceStore((s) => s.earFitResult);
  const runEarFitTest = useDeviceStore((s) => s.runEarFitTest);
  const earFitSimulated = useDeviceStore((s) => s.earFitSimulated);

  const sides = [
    { key: 'left', label: t('overview.leftEarbud') },
    { key: 'right', label: t('overview.rightEarbud') },
  ] as const;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-secondary/20 p-2">
            <img
              src="/assets/icons/ear/ear_tip_fit_test.svg"
              alt="Ear Tip Fit Test"
              className="max-h-full max-w-full object-contain opacity-90 dark:invert"
            />
          </div>
          <div>
            <CardTitle>{t('anc.earFitTitle')}</CardTitle>
            <CardDescription className="mt-1">
              {t('anc.earFitDesc')}
            </CardDescription>
          </div>
        </div>
        <Button
          onClick={runEarFitTest}
          disabled={earFitRunning}
          size="sm"
          className="shrink-0 gap-1.5"
        >
          <Play className="size-3.5" />
          {earFitRunning ? t('anc.runningFitTest') : t('anc.startFitTest')}
        </Button>
      </CardHeader>

      {earFitResult && (
        <CardContent className="pt-0">
          {earFitSimulated && (
            <div className="mb-2 flex justify-end">
              <StatusChip tone="warning">
                <FlaskConical className="size-3" />
                {t('anc.simulated')}
              </StatusChip>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 border-t border-border/60 pt-3 sm:grid-cols-2">
            {sides.map((side) => {
              const good = earFitResult[side.key] === 'good';
              return (
                <div
                  key={side.key}
                  className="flex items-center justify-between rounded-lg bg-muted/30 p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={
                        good
                          ? '/assets/icons/ear/ear_fit_status_yes.png'
                          : '/assets/icons/ear/ear_fit_status_no.png'
                      }
                      alt=""
                      className="size-6 object-contain"
                    />
                    <span className="font-medium text-xs">{side.label}</span>
                  </div>
                  <StatusChip tone={good ? 'success' : 'warning'}>
                    {good ? (
                      <CheckCircle2 className="size-3" />
                    ) : (
                      <AlertTriangle className="size-3" />
                    )}
                    {good ? t('anc.fitGood') : t('anc.fitPoor')}
                  </StatusChip>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
