import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dist-ssr/**',
      'node_modules/**',
      'src-tauri/**',
      '*.config.js',
      '*.config.ts',
      '*.cjs',
      'build/**',
      'coverage/**',
      'src/tests/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'react/react-in-jsx-scope': 'off', // Not needed in React 17+
      'react/no-unescaped-entities': 'off', // Allow apostrophes in JSX
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off', // Allow any for flexibility
      'no-console': 'off', // Allow console statements
      'react-hooks/exhaustive-deps': 'warn', // Warn instead of error for missing deps
      'react-hooks/set-state-in-effect': 'off', // Allow setState in effects for initialization
      'react-hooks/immutability': 'off', // Allow mutable patterns
      'react-hooks/purity': 'off', // Allow impure functions like Date.now()
      'react-hooks/refs': 'warn', // Warn about ref access during render
      'prefer-const': 'warn', // Warn instead of error
      'no-empty': 'warn', // Warn about empty blocks
      'no-prototype-builtins': 'warn', // Warn about hasOwnProperty
      'react/jsx-key': 'warn', // Warn about missing keys
    },
  }
);
