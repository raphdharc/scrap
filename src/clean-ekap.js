const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'ekap-results.json');
const OUTPUT_FILE = path.join(__dirname, 'ekap-cleaned.json');

// Conversion propre des montants TRY
function parseTRY(value) {
  if (!value || typeof value !== 'string') return null;
  const clean = value.replace(/[.]/g, '').replace(',', '.').replace(/\s*TRY\s*/i, '');
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

// Extraction lieu + date à partir de la chaîne type : "Antakya - 20.02.2023 10:00"
function splitLocationDatetime(locStr) {
  if (!locStr || typeof locStr !== 'string') return { location: null, datetime: null };
  const lastDash = locStr.lastIndexOf('-');
  if (lastDash === -1) return { location: locStr.trim(), datetime: null };

  const location = locStr.slice(0, lastDash).trim();
  const dateStr = locStr.slice(lastDash + 1).trim();
  const dateObj = new Date(dateStr.split('.').reverse().join('-').replace(' ', 'T'));

  return {
    location,
    datetime: isNaN(dateObj.getTime()) ? null : dateObj.toISOString()
  };
}

function main() {
  const raw = fs.readFileSync(INPUT_FILE, 'utf8');
  const tenders = JSON.parse(raw);

  const cleaned = tenders.map(t => {
    const out = { ...t };

    // Nettoyage des prix
    const moneyFields = ['Yaklaşık Maliyet', 'En Düşük Teklif', 'En Yüksek Teklif'];
    moneyFields.forEach(field => {
      const raw = t[field];
      if (raw) {
        out[`${field}_parsed`] = parseTRY(raw);
      }
    });

    // Nettoyage lieu + date
    const locInfo = t['İhale Yeri ve Tarihi'] || '';
    const { location, datetime } = splitLocationDatetime(locInfo);
    out['İhale Yeri'] = location;
    out['İhale Tarihi'] = datetime;

    return out;
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cleaned, null, 2), 'utf8');
  console.log(`✅ Données nettoyées sauvegardées dans : ${OUTPUT_FILE}`);
}

main();
