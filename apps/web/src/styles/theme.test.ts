import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(process.cwd(), 'src');
const ignoredDirectories = new Set(['components/ui', 'test']);
const colorLiteral = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;
const testFile = /\.(?:test|spec)\.tsx?$/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    const relativePath = relative(sourceRoot, path).split(sep).join('/');

    if (entry.isDirectory()) {
      return ignoredDirectories.has(relativePath) ? [] : sourceFiles(path);
    }

    return /\.tsx?$/.test(entry.name) && !testFile.test(entry.name) ? [path] : [];
  });
}

describe('color system', () => {
  it('uses semantic tokens instead of raw color literals outside the theme', () => {
    const violations = sourceFiles(sourceRoot).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          colorLiteral.test(line)
            ? [`${relative(sourceRoot, file)}:${index + 1}: ${line.trim()}`]
            : [],
        ),
    );

    expect(
      violations,
      'Declare the color in src/styles/theme.css and use its semantic token instead.',
    ).toEqual([]);
  });
});
