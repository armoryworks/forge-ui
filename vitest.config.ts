import { defineConfig, Plugin } from 'vitest/config';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';

/**
 * Vite plugin that inlines Angular component resources (templateUrl, styleUrl)
 * at transform time so Angular's JIT compiler doesn't need to fetch them.
 * Required because Vitest's jsdom environment has no fetch for local file URLs.
 */
function inlineAngularResources(): Plugin {
  return {
    name: 'inline-angular-resources',
    transform(code: string, id: string) {
      if (!id.endsWith('.ts') || id.endsWith('.spec.ts') || id.endsWith('.d.ts')) return;

      let transformed = code;

      // templateUrl → inline template string
      transformed = transformed.replace(
        /templateUrl:\s*['"`]([^'"`]+)['"`]/g,
        (_, url) => {
          try {
            const template = readFileSync(resolve(dirname(id), url), 'utf-8');
            return `template: ${JSON.stringify(template)}`;
          } catch {
            return `template: ''`;
          }
        },
      );

      // styleUrl / styleUrls → empty styles (CSS not needed in unit tests)
      transformed = transformed
        .replace(/styleUrl:\s*['"`][^'"`]+['"`]/g, 'styles: []')
        .replace(/styleUrls:\s*\[[^\]]*\]/gs, 'styles: []');

      return transformed !== code ? { code: transformed } : undefined;
    },
  };
}

export default defineConfig({
  plugins: [inlineAngularResources()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test.setup.ts'],
    include: ['src/**/*.spec.ts'],
    exclude: ['node_modules/**', 'e2e/**'],
  },
});
