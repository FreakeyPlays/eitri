import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: [".agents/skills/**"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ["apps/client/**/*.ts"],
        jsPlugins: [{ name: "@angular-eslint", specifier: "@angular-eslint/eslint-plugin" }],
        rules: {
          "@angular-eslint/component-selector": [
            "error",
            { type: "element", prefix: ["app", "lib", "hlm"], style: "kebab-case" },
          ],
          "@angular-eslint/consistent-component-styles": "error",
          "@angular-eslint/contextual-lifecycle": "error",
          "@angular-eslint/directive-selector": [
            "error",
            { type: "attribute", prefix: ["app", "lib", "hlm"], style: "camelCase" },
          ],
          "@angular-eslint/no-async-lifecycle-method": "error",
          "@angular-eslint/no-duplicates-in-metadata-arrays": "error",
          "@angular-eslint/no-empty-lifecycle-method": "error",
          "@angular-eslint/no-input-rename": "warn",
          "@angular-eslint/no-inputs-metadata-property": "error",
          "@angular-eslint/no-lifecycle-call": "error",
          "@angular-eslint/no-output-native": "error",
          "@angular-eslint/no-output-on-prefix": "error",
          "@angular-eslint/no-output-rename": "error",
          "@angular-eslint/no-outputs-metadata-property": "error",
          "@angular-eslint/no-queries-metadata-property": "error",
          "@angular-eslint/prefer-inject": "error",
          "@angular-eslint/prefer-output-readonly": "error",
          "@angular-eslint/prefer-standalone": "error",
          "@angular-eslint/require-lifecycle-on-prototype": "error",
          "@angular-eslint/use-injectable-provided-in": "error",
          "@angular-eslint/use-lifecycle-interface": "error",
          "@angular-eslint/use-pipe-transform-interface": "error",
        },
      },
    ],
  },
});
