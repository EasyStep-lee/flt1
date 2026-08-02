import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const root = path.resolve(valueAfter("--root") ?? process.cwd());
const outputPath = valueAfter("--output");
const errors = [];
const readText = (relativePath) => {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    errors.push(`MISSING_FILE:${relativePath}`);
    return "";
  }
  return fs.readFileSync(fullPath, "utf8");
};
const readJson = (relativePath) => {
  const raw = readText(relativePath);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    errors.push(`INVALID_JSON:${relativePath}:${error.message}`);
    return {};
  }
};
const requireEqual = (actual, expected, code) => {
  if (actual !== expected) errors.push(`${code}:expected=${expected}:actual=${String(actual)}`);
};
const requireIncludes = (text, expected, code) => {
  if (!text.includes(expected)) errors.push(`${code}:${expected}`);
};

const packageJson = readJson("package.json");
const turboJson = readJson("turbo.json");
const workspaceYaml = readText("pnpm-workspace.yaml");
const lockfile = readText("pnpm-lock.yaml");
const npmrc = readText(".npmrc");
const appsReadme = readText(path.join("apps", "README.md"));
const packagesReadme = readText(path.join("packages", "README.md"));
const layout = readText(path.join("docs", "architecture", "WORKSPACE_LAYOUT.md"));

requireEqual(packageJson.name, "@fulishe/root", "ROOT_PACKAGE_NAME");
requireEqual(packageJson.private, true, "ROOT_PACKAGE_PRIVATE");
requireEqual(packageJson.packageManager, "pnpm@10.12.1", "PACKAGE_MANAGER_VERSION");
requireEqual(packageJson.engines?.node, "22.23.1", "NODE_ENGINE_VERSION");
requireEqual(packageJson.engines?.pnpm, "10.12.1", "PNPM_ENGINE_VERSION");
requireEqual(packageJson.devDependencies?.turbo, "2.10.8", "TURBO_VERSION");
requireEqual(packageJson.scripts?.verify, undefined, "VERIFY_RESERVED_FOR_M0_011");
requireEqual(process.versions.node, "22.23.1", "ACTIVE_NODE_VERSION");

requireIncludes(workspaceYaml, "'apps/*'", "WORKSPACE_APPS_SCOPE");
requireIncludes(workspaceYaml, "'packages/*'", "WORKSPACE_PACKAGES_SCOPE");
requireIncludes(lockfile, "lockfileVersion: '9.0'", "LOCKFILE_VERSION");
requireIncludes(lockfile, "turbo:", "LOCKFILE_TURBO_IMPORTER");
requireIncludes(lockfile, "turbo@2.10.8", "LOCKFILE_TURBO_PACKAGE");

for (const setting of [
  "engine-strict=true",
  "link-workspace-packages=true",
  "save-exact=true",
  "shared-workspace-lockfile=true",
  "strict-peer-dependencies=true",
]) {
  requireIncludes(npmrc, setting, "NPMRC_SETTING");
}

for (const task of ["build", "dev", "lint", "typecheck", "test"]) {
  if (!turboJson.tasks?.[task]) errors.push(`TURBO_TASK_MISSING:${task}`);
}
if (turboJson.tasks?.verify) errors.push("TURBO_VERIFY_RESERVED_FOR_M0_011");

for (const app of ["api/", "company-admin/", "supplier-portal/", "portal-web/", "user-miniapp/", "runner-miniapp/"]) {
  requireIncludes(appsReadme, `\`${app}\``, "APP_RESPONSIBILITY_MISSING");
}
for (const packageName of ["db/", "contracts/", "ui/", "miniapp-kit/", "adapters/", "config/", "test-kit/"]) {
  requireIncludes(packagesReadme, `\`${packageName}\``, "PACKAGE_RESPONSIBILITY_MISSING");
}
requireIncludes(layout, "apps/*  ──────> packages/*", "DEPENDENCY_DIRECTION");
requireIncludes(layout, "M0-011", "VERIFY_OWNERSHIP");

const report = {
  schemaVersion: "1.0.0",
  taskId: "M0-004",
  status: errors.length === 0 ? "PASS" : "FAIL",
  root,
  versions: {
    node: packageJson.engines?.node ?? null,
    activeNode: process.versions.node,
    pnpm: packageJson.engines?.pnpm ?? null,
    packageManager: packageJson.packageManager ?? null,
    turbo: packageJson.devDependencies?.turbo ?? null,
  },
  workspaceScopes: ["apps/*", "packages/*"],
  turboTasks: Object.keys(turboJson.tasks ?? {}).sort(),
  guards: {
    engineStrict: npmrc.includes("engine-strict=true"),
    frozenLockfilePresent: lockfile.includes("lockfileVersion: '9.0'"),
    verifyDeferredToM0011: packageJson.scripts?.verify === undefined && turboJson.tasks?.verify === undefined,
  },
  errors,
};

if (outputPath) {
  const resolvedOutput = path.resolve(root, outputPath);
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  fs.writeFileSync(resolvedOutput, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (errors.length > 0) {
  console.error("M0-004工作区校验失败：");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("M0-004工作区校验通过。");
console.log(`Node ${report.versions.node}; pnpm ${report.versions.pnpm}; Turborepo ${report.versions.turbo}`);
console.log(`范围：${report.workspaceScopes.join(", ")}; verify保留至M0-011。`);
