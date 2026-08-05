import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

const WCAG_22_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] as const;

export type PrivacySafeAccessibilityViolation = Readonly<{
  id: string;
  impact: string;
  nodeCount: number;
}>;

export type PrivacySafeAccessibilityDiagnostic = PrivacySafeAccessibilityViolation &
  Readonly<{
    computedColors: readonly string[];
    targets: readonly string[];
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

export async function scanPhase42Accessibility(
  page: Page,
): Promise<readonly PrivacySafeAccessibilityDiagnostic[]> {
  const result = await new AxeBuilder({ page }).withTags([...WCAG_22_AA_TAGS]).analyze();
  return Promise.all(
    result.violations.map(async (violation) => {
      const targets = violation.nodes.flatMap((node) => node.target.map(String));
      const computedColors = await Promise.all(
        targets.map((target) =>
          page.locator(target).evaluate((element) => {
            const style = getComputedStyle(element);
            return `${style.color} on ${style.backgroundColor}; opacity ${style.opacity}`;
          }),
        ),
      );
      return {
        id: violation.id,
        impact: violation.impact ?? "unknown",
        nodeCount: violation.nodes.length,
        computedColors,
        targets,
      };
    }),
  );
}
