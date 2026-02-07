const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const CSV_PATH = path.join(__dirname, '..', 'ElectronicParts.csv');
const JSON_PATH = path.join(__dirname, '..', 'parts.json');

const raw = fs.readFileSync(CSV_PATH, 'utf-8');
const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true });

const byCategory = {};
for (const r of rows) {
  const cat = r.Rodzaj || 'Inne';
  if (!byCategory[cat]) byCategory[cat] = [];
  byCategory[cat].push({
    xx: r.XX,
    name: r.Name,
    quantity: r.Quantity,
    rodzaj: r.Rodzaj,
    description: r.Description || '',
  });
}

const categories = Object.keys(byCategory).sort((a, b) => a.localeCompare(b, 'pl'));
const output = categories.map((rodzaj) => ({ rodzaj, items: byCategory[rodzaj] }));

fs.writeFileSync(JSON_PATH, JSON.stringify(output, null, 2), 'utf-8');
console.log('Wygenerowano parts.json');
