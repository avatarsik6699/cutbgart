import { overwriteGetLocale } from "./src/paraglide/runtime";

// Component tests predate the bilingual shell and assert the English catalog.
// Route-level RU/EN switching is covered by Playwright; keep these focused on
// component behavior instead of duplicating every assertion per locale.
overwriteGetLocale(() => "en");
