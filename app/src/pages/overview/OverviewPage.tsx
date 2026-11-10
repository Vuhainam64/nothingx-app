import { useTranslation } from 'react-i18next';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { DeviceHeroCard } from './DeviceHeroCard';
import { BatteryCards } from './BatteryCards';
import { DeviceSpecsCard } from './DeviceSpecsCard';

export function OverviewPage() {
  const { t } = useTranslation();

  return (
    <PageContainer className="space-y-6">
      <PageHeader title={t('overview.title')} subtitle={t('overview.subtitle')} />
      <DeviceHeroCard />
      <BatteryCards />
      <DeviceSpecsCard />
    </PageContainer>
  );
}
