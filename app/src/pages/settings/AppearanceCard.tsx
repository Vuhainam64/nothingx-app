import { useTranslation } from 'react-i18next';
import { Palette, Globe, Sun, Moon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Segmented } from '@/components/Segmented';
import { LANGUAGES, type LanguageCode } from '@/i18n';
import { useTheme, VISUAL_STYLES, type VisualStyle } from '@/lib/theme';

export function AppearanceCard() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme, style, setStyle } = useTheme();
  const currentLang = (i18n.language?.slice(0, 2) || 'en') as LanguageCode;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="size-4 text-primary" />
          {t('settings.appearanceTitle')}
        </CardTitle>
        <CardDescription>{t('settings.appearanceDesc')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Language Selector using custom Radix Select */}
          <div className="p-4 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Globe className="size-4 text-primary" />
              <span className="text-sm font-medium">{t('settings.language')}</span>
            </div>
            <Select value={currentLang} onValueChange={(val) => i18n.changeLanguage(val)}>
              <SelectTrigger size="sm" className="w-[165px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.flag} {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Theme Mode Selector */}
          <div className="p-4 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {theme === 'dark' ? (
                <Moon className="size-4 text-primary" />
              ) : (
                <Sun className="size-4 text-primary" />
              )}
              <span className="text-sm font-medium">{t('settings.themeMode')}</span>
            </div>
            <Segmented
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'dark', label: t('settings.dark') },
                { value: 'light', label: t('settings.light') },
              ]}
            />
          </div>
        </div>

        {/* Visual Style Cards */}
        <div className="space-y-2 pt-1">
          <div className="text-xs font-medium text-muted-foreground">
            {t('settings.visualStyle')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {VISUAL_STYLES.map((vs) => {
              const active = style === vs.id;
              return (
                <button
                  key={vs.id}
                  type="button"
                  onClick={() => setStyle(vs.id as VisualStyle)}
                  aria-pressed={active}
                  className={`text-left p-3.5 rounded-xl border transition-all ${
                    active
                      ? 'border-primary bg-primary/10 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_30%,transparent)]'
                      : 'border-border bg-card/50 hover:bg-accent/40'
                  }`}
                >
                  <div className="text-sm font-semibold">{t(`settings.styles.${vs.id}`)}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t(`settings.styles.${vs.id}Desc`)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
