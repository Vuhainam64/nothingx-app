import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeviceStore, getCurrentDevice } from '@/lib/deviceStore';
import { useTheme } from '@/lib/theme';
import type { EqPreset } from '@/lib/bluetoothProtocol';

// Cover art ships in light/dark variants (images/ear/eq/equalizer_<name>_<theme>.png).
const EQ_COVER_NAME: Record<EqPreset, string> = {
  balanced: 'equalizer_balanced',
  moreBass: 'equalizer_bass',
  moreTreble: 'equalizer_treble',
  voice: 'equalizer_voice',
  diracOpteo: 'dirac_eq_cover',
  custom: 'equalizer_electronic',
  advanced: 'equalizer_classical',
};

const eqCover = (preset: EqPreset, theme: 'light' | 'dark') =>
  `/assets/images/ear/eq/${EQ_COVER_NAME[preset]}_${theme}.png`;

export function EqPresetCard() {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const eqPreset = useDeviceStore((s) => s.eqPreset);
  const customBands = useDeviceStore((s) => s.customBands);
  const setEqPreset = useDeviceStore((s) => s.setEqPreset);
  const setCustomBands = useDeviceStore((s) => s.setCustomBands);

  const device = getCurrentDevice(selectedModelId);

  const presets: { id: EqPreset; supported: boolean }[] = [
    { id: 'balanced', supported: true },
    { id: 'moreBass', supported: true },
    { id: 'moreTreble', supported: true },
    { id: 'voice', supported: true },
    { id: 'diracOpteo', supported: device.supportsDiracOpteo },
    { id: 'custom', supported: true },
    { id: 'advanced', supported: device.supportsParametricEq },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('equalizer.presetTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {presets
            .filter((p) => p.supported)
            .map((p) => {
              const active = eqPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setEqPreset(p.id)}
                  className={`group flex items-center gap-3.5 rounded-xl border p-4 text-left transition-all ${
                    active
                      ? 'border-primary bg-primary/10 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_30%,transparent)]'
                      : 'border-border bg-card/50 hover:bg-accent/40'
                  }`}
                >
                  <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background/80 p-1">
                    <img
                      src={eqCover(p.id, resolvedTheme)}
                      alt={t(`equalizer.presets.${p.id}`)}
                      className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-sm">
                        {t(`equalizer.presets.${p.id}`)}
                      </span>
                      <span
                        className={`size-2 shrink-0 rounded-full ${
                          active ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                      />
                    </div>
                    <p className="mt-1 line-clamp-2 text-muted-foreground text-xs leading-relaxed">
                      {t(`equalizer.presets.${p.id}Desc`)}
                    </p>
                  </div>
                </button>
              );
            })}
        </div>

        {/* 3-Band Custom Sliders */}
        {eqPreset === 'custom' && (
          <div className="space-y-4 border-t border-border/60 pt-4">
            <div className="font-semibold text-sm">{t('equalizer.customTitle')}</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {(['bass', 'mid', 'treble'] as const).map((bandKey) => {
                const value = customBands[bandKey];
                return (
                  <div
                    key={bandKey}
                    className="space-y-2.5 rounded-xl border border-border/70 bg-muted/20 p-4"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">
                        {t(`equalizer.${bandKey}`)}
                      </span>
                      <span className="font-mono font-semibold text-primary">
                        {value > 0 ? `+${value}` : value} dB
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-6}
                      max={6}
                      step={1}
                      value={value}
                      onChange={(e) =>
                        setCustomBands({
                          ...customBands,
                          [bandKey]: Number(e.target.value),
                        })
                      }
                      className="w-full cursor-pointer accent-primary"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
