import { useTranslation } from 'react-i18next';
import { PageContainer } from '@/components/PageContainer';
import { PageHeader } from '@/components/PageHeader';
import { AncModeCard } from './AncModeCard';
import { EarFitTestCard } from './EarFitTestCard';

export function NoiseControlPage() {
  const { t } = useTranslation();

  return (
    <PageContainer className="space-y-6">
      <PageHeader title={t('anc.title')} subtitle={t('anc.subtitle')} />
      <AncModeCard />
      <EarFitTestCard />
    </PageContainer>
  );
}
