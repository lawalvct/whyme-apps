// Regenerates src/schema.ts from the API's OpenAPI spec (docs/01 §3).
// Locally it reads the sibling Laravel repo; in CI set OPENAPI_URL to staging's spec.
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const pkg = join(dirname(fileURLToPath(import.meta.url)), '..');
const sibling = resolve(pkg, '../../../whyme-api/api.json');
const source = process.env.OPENAPI_URL ?? sibling;

if (!process.env.OPENAPI_URL && !existsSync(sibling)) {
  console.error(`No spec at ${sibling}. Run "php artisan scramble:export" in whyme-api, or set OPENAPI_URL.`);
  process.exit(1);
}

execFileSync('npx', ['openapi-typescript', source, '-o', join(pkg, 'src/schema.ts')], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
