import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * Lint rules only. Formatting belongs to Prettier, so nothing here has an
 * opinion about whitespace, quotes or line length — a rule that fights the
 * formatter is a rule that fails CI for no reason.
 *
 * The set is deliberately small: `strict` mode in `tsconfig.base.json` already
 * carries `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`
 * and `verbatimModuleSyntax`, which is most of what a typed lint config would
 * otherwise be re-checking. What is left here is the part the compiler does
 * not do.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.d.ts',
      // Local-only directories that `.gitignore` keeps out of the repository.
      // They carry their own tooling and are not part of any package.
      'site/**',
      'marketing/**',
      'development/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    // Everything here is either browser code or Node tooling that drives a
    // browser, so both sets are declared. TypeScript already reports unknown
    // identifiers in `.ts`, but the `.mjs` scripts have no compiler behind
    // them and `no-undef` is the only thing checking them.
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  {
    rules: {
      // `noUnusedLocals` in tsconfig already reports these, and the two
      // disagree about arguments prefixed with an underscore.
      '@typescript-eslint/no-unused-vars': 'off',

      // The codebase uses `!` where a DOM lookup is guaranteed by a line just
      // above it, and the tests use it constantly on indexed access that
      // `noUncheckedIndexedAccess` widened. Banning it would mean adding
      // assertions that say less than the `!` did.
      '@typescript-eslint/no-non-null-assertion': 'off',

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-implicit-coercion': ['error', { boolean: false }],

      /*
       * SSR tripwire: no browser global may be touched while the module is
       * being evaluated.
       *
       * Every effect in this package is client-only by design, so the SSR
       * contract is not "renders on the server" but "importing it on the
       * server does nothing and throws nothing". That holds only while
       * `window`, `document` and `navigator` stay inside function bodies,
       * where `isBrowser()` guards them — reaching one at module scope turns a
       * `import` into a crash in Node.
       *
       * The selectors match top-level statements and top-level initialisers
       * that are not functions. A `const f = () => document.body` is fine: the
       * initialiser is an arrow, which nothing here evaluates at import time.
       * `typeof window` is carved out for the reason it is the guard everyone
       * writes: `typeof` on an undeclared identifier is the one form that does
       * not throw.
       */
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Program > ExpressionStatement :matches(Identifier[name="window"], Identifier[name="document"], Identifier[name="navigator"]):not(UnaryExpression[operator="typeof"] > Identifier)',
          message:
            'No browser global at module scope — it runs on import and breaks SSR. Move it inside a function behind isBrowser().',
        },
        {
          selector:
            'Program > VariableDeclaration > VariableDeclarator > :matches(MemberExpression, CallExpression, NewExpression, ConditionalExpression, BinaryExpression, LogicalExpression) :matches(Identifier[name="window"], Identifier[name="document"], Identifier[name="navigator"]):not(UnaryExpression[operator="typeof"] > Identifier)',
          message:
            'No browser global in a module-scope initialiser — it runs on import and breaks SSR. Move it inside a function behind isBrowser().',
        },
      ],
    },
  },

  {
    // Test and tooling files are never published and never imported by a
    // server, so the SSR tripwire does not apply to them. Root `*.mjs` are
    // one-off scripts that drive a browser from Node and belong in the same
    // group.
    files: ['**/test/**', '**/*.test.ts', '**/*.config.*', 'scripts/**', '*.mjs'],
    rules: { 'no-restricted-syntax': 'off' },
  },
)
