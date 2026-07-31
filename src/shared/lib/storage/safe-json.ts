/**
 * Single entry point for parsing persisted JSON (`docs/FRONTEND_CONVENTIONS.md`
 * §6.2) — never call raw `JSON.parse` on a value read from storage. Validates
 * the parsed shape against a type guard instead of trusting `JSON.parse`'s
 * `any`, and never throws: malformed or unexpected-shape input becomes
 * `null`. Does not apply to `JSON.stringify` for a Worker `postMessage`
 * payload or another HTTP-adjacent boundary — that isn't "storage".
 */
export function safeJsonParse<T>(
  raw: string | null | undefined,
  isValid: (value: unknown) => value is T,
): T | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return isValid(parsed) ? parsed : null;
}
