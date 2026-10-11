// For Capacitor/SPA: ensure the static export works for deep links by copying index.html to common dynamic route directories
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('out');
const index = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');

const dirs = [
  'about',
  'library',
  'history',
  'download',
  'search',
  'source/nettruyen',
  'source/truyenqq',
  'manga/nettruyen/-',
  'manga/truyenqq/-',
  'read/nettruyen/-/-',
  'read/truyenqq/-/-'
];

for (const d of dirs) {
  const full = path.join(outDir, d);
  fs.mkdirSync(full, { recursive: true });
  fs.writeFileSync(path.join(full, 'index.html'), index);
}
console.log('✅ SPA fallback ready for', dirs.length, 'routes.');
