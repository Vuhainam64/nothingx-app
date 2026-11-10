import { useTranslation } from 'react-i18next';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { AudioFeaturesCard } from './AudioFeaturesCard';
import { DualConnectionCard } from './DualConnectionCard';
import { FindMyEarbudsCard } from './FindMyEarbudsCard';
import { SystemTrayCard } from './SystemTrayCard';
import { AppearanceCard } from './AppearanceCard';

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <PageContainer className="space-y-6">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <SystemTrayCard />
      <AudioFeaturesCard />
      <DualConnectionCard />
      <FindMyEarbudsCard />
      <AppearanceCard />
    </PageContainer>
  );
}
