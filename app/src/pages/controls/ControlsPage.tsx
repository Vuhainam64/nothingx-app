import { useTranslation } from 'react-i18next';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { useDeviceStore, getCurrentDevice } from '@/lib/deviceStore';
import { supportsPinchGestures } from '@/lib/nothingCommands';
import { EarbudGestureCard } from './EarbudGestureCard';
import { SmartDialCard } from './SmartDialCard';

export function ControlsPage() {
  const { t } = useTranslation();
  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const device = getCurrentDevice(selectedModelId);

  return (
    <PageContainer className="space-y-6">
      <PageHeader title={t('controls.title')} subtitle={t('controls.subtitle')} />
      {supportsPinchGestures(device) ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EarbudGestureCard side="left" />
          <EarbudGestureCard side="right" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            {t('controls.gesturesUnsupported')}
          </CardContent>
        </Card>
      )}
      <SmartDialCard />
    </PageContainer>
  );
}
