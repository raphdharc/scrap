/**
 * filter-ekap.js
 * Filtres :
 * - Procédure exacte : "Yapım - Pazarlık - Pazarlık (MD 21 B)"
 * - Non annulé
 * - "İhale Onay Tarihi" >= 6 février 2023
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'ekap-cleaned.json');
const OUTPUT_FILE = path.join(__dirname, 'ekap-filtered.json');

// Date fixe du séisme
const EARTHQUAKE_CUTOFF = new Date('2023-02-06');

function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.trim().split('.');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  return new Date(`${yyyy}-${mm}-${dd}`);
}

function main() {
  try {
    const raw = fs.readFileSync(INPUT_FILE, 'utf8');
    const data = JSON.parse(raw);

    const filtered = data.filter(item => {
      const procedureMatch = item['İhale Türü - Usulü'] === 'Yapım - Pazarlık - Pazarlık (MD 21 B)';
      const notCancelled = item['İhale Durumu'] !== 'İhale İptal Edilmiş';

      const onayDate = parseDate(item['İhale Onay Tarihi']);
      const afterQuake = onayDate && onayDate >= EARTHQUAKE_CUTOFF;

      return procedureMatch && notCancelled && afterQuake;
    });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(filtered, null, 2), 'utf8');
    console.log(`✅ ${filtered.length} appels d’offres filtrés écrits dans ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('❌ Erreur lors du filtrage :', err);
    process.exit(1);
  }
}

main();

