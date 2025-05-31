/**
 * filter-ekap.js
 * Filtre EKAP post-nettoyage pour obtenir seulement les appels d’offres :
 * - après le 06/02/2023,
 * - procédure "Yapım - Pazarlık - Pazarlık (MD 21 B)",
 * - non annulés.
 */

const fs = require('fs');
const path = require('path');

// ⚙️ Configuration des chemins et de la date du séisme
const INPUT_FILE = path.join(__dirname, 'ekap-cleaned.json');
const OUTPUT_FILE = path.join(__dirname, 'ekap-filtered.json');
const EARTHQUAKE_CUTOFF = new Date('2023-02-06');

/**
 * Parse une date au format "DD.MM.YYYY" en objet Date.
 * @param {string} str 
 * @returns {Date|null}
 */
function parseDate(str) {
  if (!str) return null;
  const parts = str.split('.');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  return new Date(`${yyyy}-${mm}-${dd}`);
}

function main() {
  try {
    // 1. Lecture du fichier JSON nettoyé
    const raw = fs.readFileSync(INPUT_FILE, 'utf8');
    const data = JSON.parse(raw);

    // 2. Filtrage selon les critères
    const filtered = data.filter(item => {
      const approvalDate = parseDate(item['İhale Onay Tarihi']);
      const afterQuake     = approvalDate && approvalDate > EARTHQUAKE_CUTOFF;
      const procedureMatch = item['İhale Türü - Usulü'] === 'Yapım - Pazarlık - Pazarlık (MD 21 B)';
      const notCancelled   = item['İhale Durumu'] !== 'İhale İptal Edilmiş';

      return afterQuake && procedureMatch && notCancelled;
    });

    // 3. Écriture du JSON filtré
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(filtered, null, 2), 'utf8');
    console.log(`✅ ${filtered.length} appels d’offres filtrés écrits dans ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('❌ Erreur lors du filtrage :', err);
    process.exit(1);
  }
}

main();
