const TEST_CODE =
  "(?:\\.(?:spec|test|stories)\\.[cm]?[jt]sx?$|(?:^|/)(?:\\.storybook|__tests__|__mocks__|test-utils)/)";
const PRODUCTION_SRC = "^(?:packages/[^/]+/src/|apps/client/projects/[^/]+/src/|apps/server/src/)";
const PORTABLE_SRC = "^(?:packages/[^/]+/src/|apps/client/projects/[^/]+/src/)";
const VITE_CONFIG = "(?:^|/)vite\\.config\\.[cm]?[jt]s$";
const TOOLING_SCRIPTS = "(?:^|/)scripts/";
const GENERATED = [
  "^packages/[^/]+/(?:dist|coverage|out-tsc|\\.angular|\\.storybook)/",
  "^apps/client/(?:dist|coverage|out-tsc|storybook-static|src-tauri|\\.angular)/",
  "^apps/server/(?:dist|coverage)/",
  "^apps/client/projects/[^/]+/(?:dist|coverage|out-tsc)/",
  "^(?:reports|\\.stryker-tmp)/",
];

/**
 * A picture has a different job than a check: the visual reporters drop what
 * only adds noise to the diagram, every other reporter keeps cruising it, so
 * the rules still apply to it.
 */
const reporter = process.argv.join(" ").match(/(?:--output-type[= ]|-T[= ])([\w-]+)/)?.[1];
const drawsAPicture = ["mermaid", "dot", "ddot", "archi", "flat"].includes(reporter);
const DIAGRAM_NOISE = [TEST_CODE, VITE_CONFIG, TOOLING_SCRIPTS];

/** @type {import("dependency-cruiser").IConfiguration} */
export default {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Keep module initialization and type dependencies acyclic.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-unresolved",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "no-undeclared-packages",
      severity: "error",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
    {
      name: "no-production-to-test",
      severity: "error",
      comment: "Tests and stories may import production code; production must not import them.",
      from: { path: PRODUCTION_SRC, pathNot: TEST_CODE },
      to: { path: TEST_CODE },
    },
    {
      name: "no-production-to-dev-dependencies",
      severity: "error",
      from: { path: PRODUCTION_SRC, pathNot: TEST_CODE },
      to: {
        dependencyTypes: ["npm-dev"],
        dependencyTypesNot: ["npm", "npm-peer"],
      },
    },
    {
      name: "contracts-stay-independent",
      severity: "error",
      comment: "Contracts define schemas and types; they cannot depend on shared behavior or apps.",
      from: { path: "^packages/contracts/" },
      to: { path: "^(?:apps/|packages/(?!contracts/)|scripts/)" },
    },
    {
      name: "shared-stays-independent-of-apps",
      severity: "error",
      comment: "Shared behavior can use contracts, but cannot reach into apps or tooling.",
      from: { path: "^packages/shared/" },
      to: { path: "^(?:apps/|scripts/)" },
    },
    {
      name: "domain-has-no-framework-dependencies",
      severity: "error",
      comment: "Keep contracts and shared logic usable outside Angular and Tauri.",
      from: { path: "^packages/(?:contracts|shared)/src/", pathNot: TEST_CODE },
      to: { path: "(?:^|/)(?:@angular|@tauri-apps|@storybook)/" },
    },
    {
      name: "use-contracts-package-exports",
      severity: "error",
      comment: "Use the package.json exports instead of relative imports across workspaces.",
      from: { pathNot: "^packages/contracts/" },
      to: {
        path: "^packages/contracts/",
        dependencyTypes: ["local", "localmodule"],
        dependencyTypesNot: ["aliased-workspace"],
      },
    },
    {
      name: "use-shared-package-exports",
      severity: "error",
      comment: "Use the package.json exports instead of relative imports across workspaces.",
      from: { pathNot: "^packages/shared/" },
      to: {
        path: "^packages/shared/",
        dependencyTypes: ["local", "localmodule"],
        dependencyTypesNot: ["aliased-workspace"],
      },
    },
    {
      name: "no-node-in-browser-or-domain",
      severity: "error",
      comment: "Platform APIs belong in adapters, outside portable domain and browser code.",
      from: { path: PORTABLE_SRC, pathNot: TEST_CODE },
      to: { dependencyTypes: ["core"] },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    builtInModules: { add: ["bun"] },
    doNotFollow: { path: "(?:^|/)node_modules/" },
    tsConfig: { fileName: "tsconfig.depcruise.json" },
    exclude: { path: drawsAPicture ? [...GENERATED, ...DIAGRAM_NOISE] : GENERATED },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "node", "default"],
    },
    reporterOptions: {
      mermaid: { minify: false },
    },
  },
};
