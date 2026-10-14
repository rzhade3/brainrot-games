import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve('src/games/factory');
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? sources(path) : entry.name.endsWith('.ts') ? [path] : [];
  });
}
const files = sources(root);
const graph = new Map<string, string[]>();
const pure = new Set([
  'game/domain.ts', 'game/model.ts', 'game/world.ts', 'game/machines.ts', 'game/simulation.ts',
  'game/settlement.ts', 'game/gathering.ts', 'game/labor.ts', 'game/flow.ts', 'session/saveState.ts', 'session/saveErrors.ts', 'game/beltRoute.ts',
]);
for (const path of files) {
  const name = relative(root, path);
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const dependencies: string[] = [];
  for (const statement of source.statements) {
    if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) ||
        !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    const typeOnly = ts.isImportDeclaration(statement)
      ? statement.importClause?.isTypeOnly
      : statement.isTypeOnly;
    if (!specifier.startsWith('.')) {
      assert.ok(!pure.has(name), `${name} must not import runtime/library dependencies: ${specifier}`);
      continue;
    }
    const asset = /\.[a-z]+$/.test(specifier) && !specifier.endsWith('.ts');
    const target = resolve(dirname(path), asset ? specifier : `${specifier.replace(/\.ts$/, '')}.ts`);
    assert.ok(target.startsWith(`${root}/`), `${name} must remain independently extractable: ${specifier}`);
    assert.ok(existsSync(target), `${name}: unresolved import ${specifier}`);
    if (pure.has(name)) assert.ok(pure.has(relative(root, target)),
      `${name} must not depend on browser/assets: ${specifier}`);
    if (!typeOnly && !asset) dependencies.push(target);
  }
  if (pure.has(name)) {
    assert.ok(!/\b(?:window|document)\s*\.|\b(?:indexedDB|localStorage|Phaser|CanvasRenderingContext2D)\b/.test(source.text),
      `${name} must remain headless`);
  }
  graph.set(path, dependencies);
  if (name.startsWith('assets/')) {
    for (const target of dependencies) {
      assert.ok(!['game/simulation.ts', 'game/world.ts', 'game/machines.ts', 'game/settlement.ts', 'session/session.ts', 'session/persistence.ts'].includes(relative(root, target)),
        `${name} must receive visual state, not import live gameplay: ${relative(root, target)}`);
    }
  }
}
const visited = new Set<string>();
function visit(path: string, stack: string[]): void {
  assert.ok(!stack.includes(path), `Runtime dependency cycle: ${[...stack, path].map(file => relative(root, file)).join(' -> ')}`);
  if (visited.has(path)) return;
  for (const target of graph.get(path) ?? []) visit(target, [...stack, path]);
  visited.add(path);
}
for (const path of files) visit(path, []);
console.log(`Factory architecture checks passed: ${files.length} modules, headless domain, independent extraction, no runtime cycles.`);
