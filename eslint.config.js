import js from '@eslint/js';

const gjsGlobals = {
    globalThis: 'readonly',
    global: 'readonly',
    console: 'readonly',
    log: 'readonly',
    logError: 'readonly',
    print: 'readonly',
    printerr: 'readonly',
    TextEncoder: 'readonly',
    TextDecoder: 'readonly',
    Intl: 'readonly',
    imports: 'readonly',
};

export default [
    {
        ignores: ['node_modules/**', 'dist/**'],
    },
    js.configs.recommended,
    {
        files: ['src/**/*.js', 'eslint.config.js'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: gjsGlobals,
        },
        rules: {
            'no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
        },
    },
    {
        files: ['scripts/**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
            globals: {process: 'readonly', console: 'readonly'},
        },
    },
];
