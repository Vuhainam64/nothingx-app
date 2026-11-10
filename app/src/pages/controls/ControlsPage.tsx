import { useTranslation } from 'react-i18next';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { useCapabilities } from '@/lib/deviceStore';
import type { GestureDeviceId, GestureSlot } from '@/lib/deviceCapabilities';
import { GestureGroupCard } from './GestureGroupCard';

const DEVICE_ORDER: GestureDeviceId[] = [2, 3, 4, 6, 7];

export function ControlsPage() {
  const { t } = useTranslation();
  const caps = useCapabilities();

  const groups: { device: GestureDeviceId; slots: GestureSlot[] }[] = DEVICE_ORDER.map(
    (device) => ({
      device,
      slots: caps.gestureSlots
        .filter((s) => s.device === device)
        .sort((a, b) => a.button - b.button || a.gesture - b.gesture),
    }),
  ).filter((g) => g.slots.length > 0);

  return (
    <PageContainer className="space-y-6">
      <PageHeader title={t('controls.title')} subtitle={t('controls.subtitle')} />
      {groups.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {groups.map((g) => (
            <GestureGroupCard key={g.device} device={g.device} slots={g.slots} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            {t('controls.gesturesUnsupported')}
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
