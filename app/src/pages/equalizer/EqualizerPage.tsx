import { useTranslation } from 'react-i18next';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { EqPresetCard } from './EqPresetCard';
import { ParametricEqCard } from './ParametricEqCard';
import { SoundEnhanceCard } from './SoundEnhanceCard';

export function EqualizerPage() {
  const { t } = useTranslation();

  return (
    <PageContainer className="space-y-6">
      <PageHeader title={t('equalizer.title')} subtitle={t('equalizer.subtitle')} />
      <EqPresetCard />
      <ParametricEqCard />
      <SoundEnhanceCard />
    </PageContainer>
  );
}
