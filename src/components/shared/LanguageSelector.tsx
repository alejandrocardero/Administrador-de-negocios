import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const LANGUAGES = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
] as const;

/**
 * Selector de idioma accesible con banderas
 */
export function LanguageSelector({ className }: { className?: string } = {}) {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  const handleChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  if (!mounted) {
    return (
      <div className={cn('w-[100px]', className)}>
        <Select value={currentLang.code} onValueChange={handleChange} disabled>
          <SelectTrigger aria-label="Seleccionar idioma">
            <SelectValue placeholder={currentLang.flag} />
          </SelectTrigger>
        </Select>
      </div>
    );
  }

  return (
    <div className={cn('w-[100px]', className)}>
      <Select value={i18n.language} onValueChange={handleChange}>
        <SelectTrigger aria-label="Seleccionar idioma" className="justify-between">
          <span className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="text-sm font-medium">{currentLang.flag}</span>
            <span className="hidden sm:inline">{currentLang.name}</span>
          </span>
        </SelectTrigger>
        <SelectContent position="popper" side="bottom" align="end">
          {LANGUAGES.map(lang => (
            <SelectItem key={lang.code} value={lang.code} className="flex items-center gap-2">
              <span className="text-base">{lang.flag}</span>
              <span>{lang.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}