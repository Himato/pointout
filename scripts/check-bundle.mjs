// Proves Pointout stays out of production builds of the demo, and shows up in development ones.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'apps/demo-angular/dist/demo-angular/browser');
// Both strings only exist in @pointout/core: the custom element name and the storage key prefix.
const markers = ['point-out', 'pointout:'];

function build(script) {
  const run = spawnSync('pnpm', ['--filter', 'demo-angular', script], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (run.status !== 0) {
    process.stdout.write(run.stdout ?? '');
    process.stderr.write(run.stderr ?? '');
    console.error(`\n✖ pnpm --filter demo-angular ${script} failed`);
    process.exit(1);
  }
}

function jsFiles(dir) {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.js'))
    .map((file) => join(dir, file));
}

function isReferenced(file, files) {
  return [...files, join(dist, 'index.html')].some(
    (other) => other !== file && readFileSync(other, 'utf8').includes(basename(file)),
  );
}

function scan(script) {
  build(script);
  const files = jsFiles(dist);
  const hits = files.filter((file) => {
    const code = readFileSync(file, 'utf8');
    return markers.some((marker) => code.includes(marker));
  });
  const named = files.filter((file) => basename(file).toLowerCase().includes('pointout'));
  // The next build wipes dist, so decide now whether anything still loads each hit.
  const orphans = new Set(hits.filter((file) => !isReferenced(file, files)));
  return { files, hits, named, orphans };
}

const prod = scan('build');
const dev = scan('build:dev');
const rel = (file) => relative(root, file);

const rows = [
  ['build', 'files scanned', 'marker hits'],
  ['production', prod.files.length, prod.hits.length],
  ['development', dev.files.length, dev.hits.length],
];
for (const [build, files, hits] of rows) {
  console.log(`${build.padEnd(13)}${String(files).padEnd(15)}${hits}`);
}

const problems = [];
if (prod.hits.length) {
  problems.push(
    `Production build contains ${markers.join(' / ')} in:`,
    ...prod.hits.map(
      (file) =>
        `  ${rel(file)}${prod.orphans.has(file) ? ' (orphan chunk, nothing imports it)' : ''}`,
    ),
  );
}
if (prod.named.length) {
  problems.push(
    'Production build has chunks named after Pointout:',
    ...prod.named.map((file) => `  ${rel(file)}`),
  );
}
if (!dev.files.some((file) => readFileSync(file, 'utf8').includes('point-out'))) {
  problems.push('Development build has no point-out at all, so this check proves nothing.');
}

if (problems.length) {
  console.error(`\n✖ ${problems.join('\n')}`);
  process.exit(1);
}
console.log('\n✔ Pointout is in the dev build and nowhere in the prod build.');
