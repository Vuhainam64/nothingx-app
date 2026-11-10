import { useTranslation } from 'react-i18next';
import { DEVICE_CATALOG } from '@/lib/deviceCatalog';
import { useDeviceStore, getCurrentDevice } from '@/lib/deviceStore';

/**
 * Display name of the selected model. A model that isn't in the catalog (e.g. a newer product detected
 * over the protocol) is shown as "Unknown model (B173)" instead of the catalog's fallback entry.
 */
export function useDeviceDisplayName(): string {
  const { t } = useTranslation();
  const selectedModelId = useDeviceStore((s) => s.selectedModelId);
  const known = DEVICE_CATALOG.some((d) => d.modelId === selectedModelId);
  return known
    ? getCurrentDevice(selectedModelId).name
    : t('setup.unknownModelBadge', { model: selectedModelId || '?' });
}
