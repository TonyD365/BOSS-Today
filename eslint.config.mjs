import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // Reader components render plain links: the public site is static HTML, not Next.js.
      '@next/next/no-html-link-for-pages': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // The static site builder renders whole HTML documents itself.
    files: ['src/site/**'],
    rules: {
      '@next/next/no-head-element': 'off',
      '@next/next/no-css-tags': 'off',
      '@next/next/no-sync-scripts': 'off',
    },
  },
  {
    ignores: ['.next/', 'src/payload-types.ts', 'src/migrations/', 'src/app/(payload)/'],
  },
]

export default eslintConfig
