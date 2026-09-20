// Validate src/metadata.json against the extensions.gnome.org requirements.
// Run by CI; fails the build on a malformed or unpublishable manifest.
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');
const path = join(src, 'metadata.json');

const errors = [];

let manifest;
try {
    manifest = JSON.parse(readFileSync(path, 'utf8'));
} catch (cause) {
    console.error(`metadata.json is not valid JSON: ${cause.message}`);
    process.exit(1);
}

const allowed = new Set([
    'uuid', 'name', 'description', 'shell-version', 'url', 'settings-schema',
    'gettext-domain', 'version-name', 'session-modes', 'donations',
]);
for (const key of Object.keys(manifest)) {
    if (key === 'version')
        errors.push('"version" is set by extensions.gnome.org; remove it');
    else if (!allowed.has(key))
        errors.push(`unknown field: "${key}"`);
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
else if (!versions.every(version => /^[1-9][0-9]*$/.test(version)))
    errors.push(`"shell-version" entries must be stable majors such as "50": ${versions.join(', ')}`);

const modes = manifest['session-modes'];
if (modes !== undefined) {
    if (!Array.isArray(modes) || !modes.every(mode => mode === 'user' || mode === 'unlock-dialog'))
        errors.push('"session-modes" may only contain "user" and "unlock-dialog"');
    else if (!modes.includes('unlock-dialog'))
        errors.push('"session-modes" without "unlock-dialog" is the default; remove the field');
}

const schema = manifest['settings-schema'] ?? '';
if (schema) {
    if (!schema.startsWith('org.gnome.shell.extensions.'))
        errors.push(`settings-schema "${schema}" must start with org.gnome.shell.extensions.`);
    const xml = join(src, 'schemas', `${schema}.gschema.xml`);
    if (!existsSync(xml))
        errors.push(`schemas/${schema}.gschema.xml is missing`);
    else if (!readFileSync(xml, 'utf8').includes(`<schema id="${schema}"`))
        errors.push(`schemas/${schema}.gschema.xml does not define schema id "${schema}"`);
}

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
