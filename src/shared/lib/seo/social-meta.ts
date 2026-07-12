import { SITE_URL } from "./json-ld";

export type Locale = "ru" | "en";

export interface AlternateLocalePath {
  locale: Locale;
  path: string;
}

export interface SocialMetaInput {
  title: string;
  description: string;
  /** Canonical path of this page in its own locale, e.g. `/about` or `/en/about`. */
  path: string;
  locale: Locale;
  /** Every locale variant of this page, including this one (Phase 12 §5.5). */
  alternates: AlternateLocalePath[];
  /** Absolute or root-relative image URL; defaults to the shared OG image. */
  image?: string;
}

/**
 * Shared OG/Twitter Card meta + `hreflang`/`x-default` alternate links for a
 * route's `head()` (SPEC.md §7.5, Phase 12 F10). One builder so every route
 * emits the same tag shape — `F11`'s `/en/...` routes reuse this unchanged.
 */
export function buildSocialMeta({
  title,
  description,
  path,
  locale,
  alternates,
  image = `${SITE_URL}/og-image.png`,
}: SocialMetaInput) {
  const url = `${SITE_URL}${path}`;
  const defaultAlternate = alternates.find((alt) => alt.locale === "ru") ?? alternates[0];

  return {
    meta: [
      { property: "og:type", content: "website" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { property: "og:locale", content: locale === "ru" ? "ru_RU" : "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
    ],
    links: [
      { rel: "canonical", href: url },
      ...alternates.map((alt) => ({
        rel: "alternate",
        hreflang: alt.locale,
        href: `${SITE_URL}${alt.path}`,
      })),
      ...(defaultAlternate
        ? [
            {
              rel: "alternate",
              hreflang: "x-default",
              href: `${SITE_URL}${defaultAlternate.path}`,
            },
          ]
        : []),
    ],
  };
}
