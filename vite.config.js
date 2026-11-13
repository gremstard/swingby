import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// Single self-contained index.html: works from file://, itch.io, any static host.
export default defineConfig({ base: './', plugins: [viteSingleFile()], build: { target: 'es2020', cssCodeSplit: false, assetsInlineLimit: 100000000 } });
