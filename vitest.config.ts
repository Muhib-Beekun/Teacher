import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['tests/unit/**/*.test.{ts,tsx}'],
        setupFiles: ['tests/unit/setup.ts'],
    },
    esbuild: {
        jsx: 'automatic',
        jsxImportSource: 'preact',
    },
    resolve: {
        alias: {
            'react': 'preact/compat',
            'react-dom': 'preact/compat',
            'react/jsx-runtime': 'preact/jsx-runtime',
            vscode: path.resolve(__dirname, 'tests/unit/mocks/vscode.ts'),
        },
    },
});
