import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, currentLanguage, LANGUAGES, type LanguageCode } from '@/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function LangSwitch() {
  const { t } = useTranslation();
  const current = currentLanguage();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('settings.language')}>
              <Languages className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('settings.language')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-44 whitespace-nowrap">
        <DropdownMenuLabel>{t('settings.language')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={current}
          onValueChange={(value) => void changeLanguage(value as LanguageCode)}
        >
          {LANGUAGES.map((lng) => (
            <DropdownMenuRadioItem key={lng.code} value={lng.code}>
              {lng.flag} {lng.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
