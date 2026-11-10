import { useTranslation } from 'react-i18next';
import { ShieldAlert, Ear, PowerOff, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Segmented } from '@/components/Segmented';
import { useDeviceStore, getCurrentDevice } from '@/lib/deviceStore';
import type { AncMode, AncLevel } from '@/lib/bluetoothProtocol';

export function AncModeCard() {
  const { t } = useTranslation();
  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const ancMode = useDeviceStore((s) => s.ancMode);
  const ancLevel = useDeviceStore((s) => s.ancLevel);
  const personalAnc = useDeviceStore((s) => s.personalAnc);
  const setAncMode = useDeviceStore((s) => s.setAncMode);
  const setAncLevel = useDeviceStore((s) => s.setAncLevel);
  const setPersonalAnc = useDeviceStore((s) => s.setPersonalAnc);

  const device = getCurrentDevice(selectedModelId);

  const modes: { id: AncMode; icon: typeof ShieldAlert; label: string; desc: string }[] = [
    {
      id: 'anc',
      icon: ShieldAlert,
      label: t('anc.modes.anc'),
      desc: t('anc.modes.ancDesc'),
    },
    {
      id: 'transparency',
      icon: Ear,
      label: t('anc.modes.transparency'),
      desc: t('anc.modes.transparencyDesc'),
    },
    {
      id: 'off',
      icon: PowerOff,
      label: t('anc.modes.off'),
      desc: t('anc.modes.offDesc'),
    },
  ];

  const levelOptions: { value: AncLevel; label: string }[] = [
    { value: 'high', label: t('anc.levels.high') },
    { value: 'mid', label: t('anc.levels.mid') },
    { value: 'low', label: t('anc.levels.low') },
    { value: 'adaptive', label: t('anc.levels.adaptive') },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('anc.modeTitle')}</CardTitle>
          <CardDescription>{t('anc.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 3 Mode Selector Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {modes.map((m) => {
              const Icon = m.icon;
              const active = ancMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setAncMode(m.id)}
                  className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                    active
                      ? 'border-primary bg-primary/10 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_30%,transparent)]'
                      : 'border-border bg-card/50 hover:bg-accent/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`size-9 rounded-lg flex items-center justify-center ${
                        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <span
                      className={`size-2.5 rounded-full ${
                        active ? 'bg-primary' : 'bg-muted-foreground/30'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{m.label}</div>
                    <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{m.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Intensity Selector when ANC is active */}
          {ancMode === 'anc' && (
            <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{t('anc.intensityTitle')}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {t(`anc.levels.${ancLevel}Desc`)}
                </div>
              </div>
              <Segmented value={ancLevel} onChange={setAncLevel} options={levelOptions} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Personalised ANC */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {device.supportsPersonalAnc && (
          <Card>
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-primary/12 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{t('anc.personalAnc')}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {t('anc.personalAncDesc')}
                  </div>
                </div>
              </div>
              <Switch checked={personalAnc} onCheckedChange={setPersonalAnc} />
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
