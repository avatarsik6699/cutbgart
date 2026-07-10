// JSON-LD builders for TanStack Router's `head().scripts` (SPEC.md §7.5).
// Plain data builders — no React/DOM dependency — so each route's `head()`
// can pass the result straight into `JSON.stringify(...)`.

/** Production origin (SPEC.md §1: domain `cutbg.art`) — used for canonical
 * links and JSON-LD `url` fields. Not an env var (Contracts: no new env vars
 * this phase) since it never varies by deployment target. */
export const SITE_URL = "https://cutbg.art";

export interface WebApplicationJsonLdInput {
  name: string;
  url: string;
  description: string;
}

export function buildWebApplicationJsonLd(input: WebApplicationJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: input.name,
    url: input.url,
    description: input.description,
    applicationCategory: "PhotoEditingApplication",
    operatingSystem: "Any (runs in the browser)",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}

export interface HowToStepInput {
  name: string;
  text: string;
}

export interface HowToJsonLdInput {
  name: string;
  description: string;
  url: string;
  steps: HowToStepInput[];
}

export function buildHowToJsonLd(input: HowToJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name,
    description: input.description,
    url: input.url,
    step: input.steps.map((step) => ({
      "@type": "HowToStep",
      name: step.name,
      text: step.text,
    })),
  };
}
