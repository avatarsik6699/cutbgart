import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

const WCAG_22_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] as const;

export type PrivacySafeAccessibilityViolation = Readonly<{
  id: string;
  impact: string;
  nodeCount: number;
}>;

export async function scanPhase38Accessibility(
  page: Page,
): Promise<readonly PrivacySafeAccessibilityViolation[]> {
  const result = await new AxeBuilder({ page }).withTags([...WCAG_22_AA_TAGS]).analyze();
  return result.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact ?? "unknown",
    nodeCount: violation.nodes.length,
  }));
}
