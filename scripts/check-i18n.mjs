// Compares the en and ig catalogs. Keys in ig that don't exist in en are errors;
// keys missing from ig are warnings, or errors with --strict (release gate, Phase 5).
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const strict = process.argv.includes('--strict');
const localesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'i18n', 'locales');

function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object' ? flatten(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

const load = (lang, file) => JSON.parse(readFileSync(join(localesDir, lang, file), 'utf8'));

let missing = 0;
let extra = 0;

for (const file of readdirSync(join(localesDir, 'en'))) {
  const en = new Set(flatten(load('en', file)));
  let ig;
  try {
    ig = new Set(flatten(load('ig', file)));
  } catch {
    ig = new Set();
  }
  const ns = file.replace('.json', '');
  const missingKeys = [...en].filter((k) => !ig.has(k));
  const extraKeys = [...ig].filter((k) => !en.has(k));
  missing += missingKeys.length;
  extra += extraKeys.length;
  for (const k of extraKeys) console.error(`✗ ig/${ns}: "${k}" is not in en`);
  if (missingKeys.length) console.log(`${strict ? '✗' : '!'} ig/${ns}: ${missingKeys.length} key(s) not translated yet`);
}

console.log(`\nIgbo: ${missing} missing, ${extra} unknown.`);
if (extra > 0 || (strict && missing > 0)) process.exit(1);
