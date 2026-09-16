// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', '.wrangler/**'],
  },

  // Type-aware linting, scoped to the TypeScript sources that belong to a
  // tsconfig project. Applying it more widely makes the parser look for a
  // project that config and build files are deliberately not part of.
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },

  // Config and build scripts: plain JavaScript rules only, with Node globals.
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js', 'vitest.config.ts'],
    extends: [eslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
);
