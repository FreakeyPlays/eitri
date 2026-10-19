import { existsSync, globSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { defineConfig, type TestProjectInlineConfiguration, type ViteUserConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  test: process.env["STRYKER_MUTATOR_WORKER"] ? await mutationTests() : undefined,
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

/**
 * Every workspace's unit test projects as one Vitest instance, so Stryker's vitest runner keeps it
 * warm and runs only the tests covering each mutant. Only Stryker's workers load it, so nothing
 * else pays for importing the client's Angular and Storybook plugins.
 */
async function mutationTests() {
  const root = import.meta.dirname;
  const { workspaces }: { workspaces: string[] } = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  );
  const packages = workspaces
    .flatMap((pattern) => globSync(`${pattern}/package.json`, { cwd: root }))
    .map((manifest) => {
      const { name, exports = {} }: { name: string; exports?: Record<string, string> } = JSON.parse(
        readFileSync(join(root, manifest), "utf8"),
      );
      return { name, exports, dir: join(root, dirname(manifest)) };
    });

  // The sandbox symlinks each node_modules back to the real checkout, so workspace imports would
  // resolve to the unmutated packages. Point every export at the sandbox copy instead.
  const alias = packages.flatMap(({ name, exports, dir }) =>
    Object.entries(exports).map(([subpath, target]) => ({
      find: join(name, subpath),
      replacement: join(dir, target),
    })),
  );

  const projects = await Promise.all(
    packages.map(async ({ name, dir }) => {
      // A computed specifier keeps Vite from bundling package configs, and their plugins, into this file.
      const file = join(dir, "vite.config.ts");
      const config: ViteUserConfig = existsSync(file) ? (await import(file)).default : {};
      const candidates = config.test?.projects ?? [{ ...config, test: { ...config.test, name } }];
      return (
        candidates
          .filter(
            (project): project is TestProjectInlineConfiguration => typeof project === "object",
          )
          // Stryker's vitest runner can't run browser mode.
          .filter((project) => !project.test?.browser?.enabled)
          // Without `extends`, a project doesn't re-bundle this file into the shared
          // node_modules/.vite-temp, which races across workers.
          .map((project) => ({
            ...project,
            extends: undefined,
            root: dir,
            resolve: { ...project.resolve, alias },
          }))
      );
    }),
  );
  return { projects: projects.flat() };
}
