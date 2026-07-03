import { build } from 'esbuild';

const dev = process.argv.includes('--dev');

await build({
    entryPoints: ['src/web-ui/index.tsx'],
    outdir: 'media',
    entryNames: 'teacher-app',
    bundle: true,
    minify: !dev,
    sourcemap: dev,
    target: ['es2020'],
    jsx: 'automatic',
    jsxImportSource: 'preact',
    format: 'iife',
    logLevel: 'info',
});
