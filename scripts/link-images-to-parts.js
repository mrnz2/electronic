/**
 * Dopisuje do parts.json pole "image" (nazwa pliku z img/) dla każdego elementu,
 * którego zdjęcie istnieje w katalogu img/ (nazwy plików = sanitized nazwa elementu).
 * Uruchomienie: node scripts/link-images-to-parts.js
 */

const fs = require('fs');
const path = require('path');

const PARTS_JSON_PATH = path.join(__dirname, '..', 'parts.json');
const IMG_DIR = path.join(__dirname, '..', 'img');

const POLISH_MAP = {
  ą: 'a', Ą: 'A', ć: 'c', Ć: 'C', ę: 'e', Ę: 'E', ł: 'l', Ł: 'L',
  ń: 'n', Ń: 'N', ó: 'o', Ó: 'O', ś: 's', Ś: 'S', ź: 'z', Ź: 'Z',
  ż: 'z', Ż: 'Z',
};

function sanitizeFilename(name) {
  if (!name || typeof name !== 'string') return 'unnamed';
  let s = name.trim();
  for (const [pl, ascii] of Object.entries(POLISH_MAP)) {
    s = s.split(pl).join(ascii);
  }
  s = s.replace(/\s+/g, '_');
  s = s.replace(/[^a-zA-Z0-9_\-]/g, '');
  s = s.replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (s.length > 80) s = s.slice(0, 80);
  return s || 'unnamed';
}

function main() {
  if (!fs.existsSync(PARTS_JSON_PATH)) {
    console.error('Brak pliku parts.json');
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(PARTS_JSON_PATH, 'utf-8'));

  const imgFiles = fs.existsSync(IMG_DIR)
    ? fs.readdirSync(IMG_DIR).filter((f) => /\.(jpe?g|png|gif|webp)$/i.test(f))
    : [];
  const baseToFile = {};
  for (const f of imgFiles) {
    const base = path.basename(f, path.extname(f));
    baseToFile[base] = f;
    const baseAlt = base.replace(/^1N/, 'IN');
    if (baseAlt !== base) baseToFile[baseAlt] = f;
  }

  let linked = 0;
  for (const cat of data) {
    for (const item of cat.items) {
      delete item.image;
      const base = sanitizeFilename(item.name);
      const file = baseToFile[base] || baseToFile[base.replace(/^1N/, 'IN')];
      if (file) {
        item.image = file;
        linked++;
      }
    }
  }

  fs.writeFileSync(PARTS_JSON_PATH, JSON.stringify(data, null, 2), 'utf-8');
  console.log('Zaktualizowano parts.json: %d elementów ma przypisane zdjęcie (pole image).', linked);
}

main();
