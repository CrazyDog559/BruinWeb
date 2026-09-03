import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * The `@/` alias is declared here rather than via a plugin: resolving it by
 * hand keeps the dependency tree small and avoids pulling a second copy of Vite
 * into the project. JSX is handled by Vite's built-in esbuild transform using
 * the `jsx: "react-jsx"` setting from tsconfig.json.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
