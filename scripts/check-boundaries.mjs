import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nxBin = path.join(root, 'node_modules', 'nx', 'dist', 'bin', 'nx.js');

const raw = execFileSync(process.execPath, [nxBin, 'graph', '--print'], {
  cwd: root,
  encoding: 'utf8',
});

const graph = JSON.parse(raw).graph;
const nodes = graph.nodes ?? {};
const dependencies = graph.dependencies ?? {};

const tagsOf = (project) => new Set(nodes[project]?.data?.tags ?? []);
const hasTag = (project, tag) => tagsOf(project).has(tag);
const internalDependencies = (project) =>
  (dependencies[project] ?? [])
    .map((dependency) => dependency.target)
    .filter((target) => Boolean(nodes[target]));

const violations = [];

for (const [source, dependenciesForSource] of Object.entries(dependencies)) {
  for (const dependency of dependenciesForSource) {
    const target = dependency.target;
    if (!nodes[target]) continue;

    if (hasTag(source, 'type:app') && hasTag(target, 'type:app')) {
      violations.push(`${source} -> ${target}: apps must not depend on other apps`);
    }

    if (hasTag(source, 'type:lib') && hasTag(target, 'type:app')) {
      violations.push(`${source} -> ${target}: packages must not depend on apps`);
    }

    if (hasTag(source, 'type:test') && hasTag(target, 'type:app')) {
      violations.push(`${source} -> ${target}: tests must not depend on apps`);
    }
  }
}

// Explicit package-level dependency contracts from the architecture context.
const allowedDependencies = new Map([
  ['web', new Set(['domain', 'configuration'])],
  ['domain', new Set()],
  ['trading-engine', new Set(['domain'])],
  ['strategies', new Set(['domain', 'trading-engine'])],
  ['risk-engine', new Set(['domain'])],
  ['execution-engine', new Set(['domain'])],
  ['backtesting', new Set(['domain', 'trading-engine', 'risk-engine', 'execution-engine'])],
  ['market-data', new Set(['domain'])],
  ['adapters', new Set(['domain', 'market-data', 'execution-engine'])],
  ['database', new Set(['domain'])],
  ['configuration', new Set(['domain'])],
  ['notifications', new Set(['domain'])],
  ['observability', new Set()],
]);

for (const [project, allowed] of allowedDependencies) {
  for (const target of internalDependencies(project)) {
    if (!allowed.has(target)) {
      violations.push(`${project} -> ${target}: dependency is outside the ${project} contract`);
    }
  }
}

if (violations.length > 0) {
  console.error('Architecture boundary violations:');
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}

console.log(`Architecture boundaries OK (${Object.keys(nodes).length} projects).`);
