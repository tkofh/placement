import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: ['typescript', 'unicorn', 'oxc', 'import'],
  categories: { correctness: 'error', suspicious: 'warn', perf: 'warn' },
  rules: {
    'no-empty': 'off',
    'no-empty-pattern': 'off',
    // Effect-style modules export ops (track, flexbox, center, angle) whose
    // names are also the natural parameter names. Shadowing is frequent and
    // intentional here.
    'no-shadow': 'off',
    'no-underscore-dangle': 'off',
    'no-case-declarations': 'warn',
    'no-unused-private-class-members': 'error',
    'no-dupe-else-if': 'warn',
    '@typescript-eslint/array-type': ['error', { default: 'generic' }],
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/consistent-type-exports': 'error',
    '@typescript-eslint/no-namespace': 'error',
    '@typescript-eslint/no-unused-vars': 'warn',
    'import/no-default-export': 'error',
    'import/extensions': ['error', 'always', { ignorePackages: true }],
    curly: 'error',
    'no-lonely-if': 'error',
    'operator-assignment': 'error',
    'require-await': 'warn',
    'unicorn/filename-case': ['error', { case: 'camelCase' }],
    'typescript/no-namespace': ['error', { allowDeclarations: true }],
  },
  env: { builtin: true },
  ignorePatterns: ['apps/playground'],
  overrides: [
    {
      // Nuxt modules are default exports by contract.
      files: ['**/*.config.ts', '**/*.bench.ts', '**/test/**/*.ts', '**/src/nuxt.ts'],
      rules: { 'import/no-default-export': 'off' },
    },
    { files: ['**/utils.ts'], rules: { 'prefer-rest-params': 'off' } },
    {
      // Vue components are PascalCase by convention.
      files: ['packages/vue/src/components/**'],
      rules: { 'unicorn/filename-case': ['error', { case: 'pascalCase' }] },
    },
  ],
})
