import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDeviceStore } from '@/lib/deviceStore';

export function ParametricEqCard() {
  const { t } = useTranslation();
  const eqPreset = useDeviceStore((s) => s.eqPreset);
  const parametricBands = useDeviceStore((s) => s.parametricBands);
  const updateParametricBand = useDeviceStore((s) => s.updateParametricBand);
  const resetParametricBands = useDeviceStore((s) => s.resetParametricBands);

  if (eqPreset !== 'advanced') return null;

  // Compute SVG polyline points for the 8-band frequency curve
  const points = parametricBands
    .map((b, idx) => {
      const x = 35 + (idx / (parametricBands.length - 1)) * 530;
      const y = 75 - (b.gain / 12) * 55;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>{t('equalizer.advancedTitle')}</CardTitle>
          <CardDescription className="mt-1">
            {t('equalizer.advancedSubtitle')} {t('equalizer.peakOnlyNote')}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={resetParametricBands} className="gap-1.5">
          <RotateCcw className="size-3.5" />
          {t('equalizer.resetCurve')}
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Frequency Response Curve Visualizer */}
        <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
          <svg viewBox="0 0 600 150" className="w-full h-36 overflow-visible">
            <line
              x1="20"
              y1="75"
              x2="580"
              y2="75"
              stroke="currentColor"
              strokeOpacity="0.18"
              strokeDasharray="4 4"
            />
            <polyline
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.5"
              points={points}
            />
            {parametricBands.map((b, idx) => {
              const x = 35 + (idx / (parametricBands.length - 1)) * 530;
              const y = 75 - (b.gain / 12) * 55;
              return (
                <g key={idx}>
                  <circle cx={x} cy={y} r="4.5" className="fill-primary" />
                  <text
                    x={x}
                    y="142"
                    textAnchor="middle"
                    className="fill-muted-foreground text-[10px] font-mono"
                  >
                    {b.freq >= 1000 ? `${b.freq / 1000}k` : b.freq}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 8-Band Sliders + Custom Radix Filter Select */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {parametricBands.map((band, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl border border-border/70 bg-card/50 space-y-3"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-semibold">
                  {band.freq >= 1000 ? `${band.freq / 1000} kHz` : `${band.freq} Hz`}
                </span>
                <span className="font-mono text-primary font-semibold">
                  {band.gain > 0 ? `+${band.gain.toFixed(1)}` : band.gain.toFixed(1)} dB
                </span>
              </div>

              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                value={band.gain}
                onChange={(e) => updateParametricBand(idx, { gain: Number(e.target.value) })}
                className="w-full accent-primary cursor-pointer"
              />

              <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
                <span>{t('equalizer.filterType')}</span>
                <span className="font-mono">{t('equalizer.filterPeak')} · Q {band.q.toFixed(1)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
