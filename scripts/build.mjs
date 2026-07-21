import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
const source = await readFile('index.html', 'utf8');
if (/script\.google\.com|anthropic-dangerous-direct-browser-access|settingsGasUrl|settingsGasPassword|apiKeyInput/.test(source)) {
  throw new Error('Public source still contains legacy browser-side integrations.');
}
await writeFile('dist/index.html', source);
console.log('Static client written to dist/.');
