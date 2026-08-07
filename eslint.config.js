import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "dist",
      ".output",
      ".nitro",
      "node_modules",
      "deploy/model-assets*",
      "src/routeTree.gen.ts",
      "src/paraglide",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    // Nested conditional expressions hide branch ownership in both domain
    // policy and presentation. Named decisions are enforced frontend-wide.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-nested-ternary": "error",
    },
  },
  {
    // Existing capability contracts may still use type-only namespaces.
    // The frontend contract no longer requires them, so ordinary module
    // exports and retained namespaces coexist without a migration sweep.
    files: ["src/**/*.types.ts"],
    rules: {
      "@typescript-eslint/no-namespace": "off",
    },
  },
  {
    // Rendered JSX slots are PascalCase so they are visually distinct from
    // ordinary data and callback props at both declaration and call sites.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "TSPropertySignature[key.type='Identifier'][key.name=/^[a-z].*Slot$/]",
          message: "Renderable slot props must use a PascalCase name.",
        },
        {
          selector: "JSXAttribute[name.name=/^[a-z].*Slot$/]",
          message: "Renderable slot props must use a PascalCase name.",
        },
      ],
    },
  },
  {
    // Primitive/trigger prop filters intentionally omit consumed sibling
    // properties before forwarding the safe remainder to the underlying element.
    files: [
      "src/shared/ui/media/**/*.{ts,tsx}",
      "src/shared/ui/site/site-link-anchor.tsx",
      "src/shared/ui/typography/**/*.{ts,tsx}",
      "src/v2/presentation/shared/diagnostics/components/diagnostics-trigger-button.tsx",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
      // React 19 exposes ref as a normal prop. The hooks plugin currently marks
      // the complete props object as ref-tainted and reports ordinary fields.
      "react-hooks/refs": "off",
    },
  },
  {
    // TanStack Router's file-based routing convention requires each route
    // file to export both `Route` and its component — incompatible with
    // react-refresh's single-component-export assumption.
    files: ["src/routes/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // @feature-sliced/steiger-plugin's exported config array type doesn't
    // line up cleanly with steiger's own `defineConfig` generic — a type
    // mismatch between the two packages, not an issue in our code.
    files: ["steiger.config.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },
  eslintConfigPrettier,
);
