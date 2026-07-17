import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
// The retained first script is the pre-migration UI implementation. Excluding
// it from the published bundle prevents its former browser-side integrations
// from being shipped; the second script is the Sites API adapter.
const source = await readFile('index.html', 'utf8');
const client = source.replace(/<script>[\s\S]*?<\/script>/, '');
await writeFile('dist/index.html', client);
console.log('Static client written to dist/.');
