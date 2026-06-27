// Validate src/metadata.json against the extensions.gnome.org requirements.
// Run by CI; fails the build on a malformed or unpublishable manifest.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const path = join(here, '..', 'src', 'metadata.json');

const errors = [];

let manifest;
try {
    manifest = JSON.parse(readFileSync(path, 'utf8'));
} catch (cause) {
    console.error(`metadata.json is not valid JSON: ${cause.message}`);
    process.exit(1);
}

const required = ['uuid', 'name', 'description', 'shell-version', 'settings-schema', 'url'];
for (const key of required) {
    if (manifest[key] === undefined || manifest[key] === '')
        errors.push(`missing or empty required field: "${key}"`);
}

const uuid = manifest.uuid ?? '';
if (uuid) {
    if (!/^[A-Za-z0-9_.-]+@[A-Za-z0-9_.-]+$/.test(uuid))
        errors.push(`uuid "${uuid}" must have the form name@domain`);
    const domain = uuid.slice(uuid.indexOf('@') + 1).toLowerCase();
    if (domain === 'local' || domain.endsWith('.local'))
        errors.push(`uuid domain "${domain}" is rejected by EGO; use a domain you control`);
}

const versions = manifest['shell-version'];
if (!Array.isArray(versions) || versions.length === 0)
    errors.push('"shell-version" must be a non-empty array');

const url = manifest.url ?? '';
if (url && !/^https?:\/\//.test(url))
    errors.push(`url "${url}" must be an http(s) URL`);

if (errors.length > 0) {
    console.error('metadata.json failed validation:');
    for (const message of errors)
        console.error(`  - ${message}`);
    process.exit(1);
}

console.log(`metadata.json OK (${uuid}, shell-version ${versions.join(', ')})`);
