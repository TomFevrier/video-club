import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  { ignores: ['build/', '.svelte-kit/', 'node_modules/', '.cache/', 'src/lib/data/'] },
  js.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  ...svelte.configs['flat/prettier'],
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  {
    // Svelte 5 `$state` / `$derived` / `$props` runes in .svelte and .svelte.js files
    files: ['**/*.svelte', '**/*.svelte.js'],
    languageOptions: {
      globals: {
        $state: 'readonly',
        $derived: 'readonly',
        $props: 'readonly',
        $effect: 'readonly',
        $bindable: 'readonly'
      }
    }
  }
];
