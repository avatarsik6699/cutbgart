import { getLocale, locales, localizeHref } from "@/paraglide/runtime";
import { m } from "@/paraglide/messages";
import { cn, useRouter } from "@/shared/lib";

const LOCALE_LABELS = {
  ru: () => m.navLanguageRu(),
  en: () => m.navLanguageEn(),
} satisfies Record<(typeof locales)[number], () => string>;

export function LanguageSwitcher() {
  const router = useRouter();
  const href = router.location.href;
  const currentLocale = getLocale();

  return (
    <div className="flex items-center gap-1 text-sm" aria-label="Language">
      {locales.map((locale, index) => (
        <span key={locale} className="flex items-center gap-1">
          {index > 0 && <span className="text-muted-foreground/50">/</span>}
          <a
            href={localizeHref(href, { locale })}
            aria-current={locale === currentLocale ? "page" : undefined}
            aria-label={LOCALE_LABELS[locale]()}
            title={LOCALE_LABELS[locale]()}
            className={cn(
              "px-1 uppercase",
              locale === currentLocale
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {locale}
          </a>
        </span>
      ))}
    </div>
  );
}
