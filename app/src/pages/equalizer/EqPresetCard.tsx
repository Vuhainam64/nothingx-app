import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDeviceStore, useCapabilities } from '@/lib/deviceStore';
import { useTheme } from '@/lib/theme';
import type { EqPreset } from '@/lib/bluetoothProtocol';
import type { DiracMode } from '@/lib/deviceCapabilities';
import {
  diracCover,
  eqCover,
  visibleDiracModes,
  visibleEqPresets,
} from '@/components/device/capabilityUi';

interface Choice {
  key: string;
  active: boolean;
  image: string;
  title: string;
  desc: string;
  onSelect: () => void;
}

function ChoiceGrid({ items }: { items: Choice[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={c.onSelect}
          aria-pressed={c.active}
          className={`group flex items-center gap-3.5 rounded-xl border p-4 text-left transition-all ${
            c.active
              ? 'border-primary bg-primary/10 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_30%,transparent)]'
              : 'border-border bg-card/50 hover:bg-accent/40'
          }`}
        >
          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-background/80 p-1">
            <img
              src={c.image}
              alt=""
              className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-semibold text-sm">{c.title}</span>
              <span
                className={`size-2 shrink-0 rounded-full ${
                  c.active ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              />
            </div>
            {c.desc && (
              <p className="mt-1 line-clamp-2 text-muted-foreground text-xs leading-relaxed">
                {c.desc}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

export function EqPresetCard() {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const caps = useCapabilities();
  const eqPreset = useDeviceStore((s) => s.eqPreset);
  const diracMode = useDeviceStore((s) => s.diracMode);
  const customBands = useDeviceStore((s) => s.customBands);
  const setEqPreset = useDeviceStore((s) => s.setEqPreset);
  const setDiracMode = useDeviceStore((s) => s.setDiracMode);
  const setCustomBands = useDeviceStore((s) => s.setCustomBands);

  const presets: EqPreset[] = visibleEqPresets(caps);
  const diracModes: DiracMode[] = visibleDiracModes(caps);
  const diracReplacesEq = Boolean(caps.dirac?.replacesEq);

  const presetChoices: Choice[] = presets.map((p) => ({
    key: p,
    active: eqPreset === p,
    image: eqCover(p, resolvedTheme),
    title: t(`equalizer.presets.${p}`),
    desc: t(`equalizer.presets.${p}Desc`),
    onSelect: () => setEqPreset(p),
  }));

  // Dirac sub-modes are active when Dirac replaces the EQ, or when the Dirac preset is selected
  // (setDiracMode switches eqPreset to 'diracOpteo' itself).
  const diracActive = diracReplacesEq || eqPreset === 'diracOpteo';
  const diracChoices: Choice[] = diracModes.map((m) => ({
    key: m,
    active: diracActive && diracMode === m,
    image: diracCover(m, resolvedTheme),
    title: t(`equalizer.dirac.${m}`),
    desc: '',
    onSelect: () => setDiracMode(m),
  }));

  const showCustom = eqPreset === 'custom' && caps.simpleCustomEq !== null && presets.includes('custom');

  if (presetChoices.length === 0 && diracChoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('equalizer.presetTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{t('equalizer.unsupported')}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('equalizer.presetTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {presetChoices.length > 0 && <ChoiceGrid items={presetChoices} />}

        {diracChoices.length > 0 && (
          <div className={presetChoices.length > 0 ? 'space-y-3 border-t border-border/60 pt-4' : 'space-y-3'}>
            <div>
              <div className="font-semibold text-sm">{t('equalizer.diracTitle')}</div>
              <div className="mt-0.5 text-muted-foreground text-xs">{t('equalizer.diracDesc')}</div>
            </div>
            <ChoiceGrid items={diracChoices} />
          </div>
        )}

        {/* 3-Band Custom Sliders */}
        {showCustom && (
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
