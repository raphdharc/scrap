/**
 * export-csv.js
 *
 * Lit `ekap-filtered.json`, génère :
 *  1) `ekap-full.csv` (toutes les colonnes)
 *  2) Dans le dossier `neo4j_csv/` :
 *     - `projects.csv`
 *     - `administrations.csv`
 *     - `admin_sup.csv`
 *     - `admin_int.csv`
 *     - `procedures.csv`
 *     - `relations.csv`
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE     = path.join(__dirname, 'ekap-filtered.json');
const FULL_CSV_FILE  = path.join(__dirname, 'ekap-full.csv');
const NEO4J_DIR      = path.join(__dirname, 'neo4j_csv');

// 1. Assure l’existence du dossier neo4j_csv
if (!fs.existsSync(NEO4J_DIR)) {
  fs.mkdirSync(NEO4J_DIR);
}

// Helper pour convertir un tableau d’objets JSON en CSV
function jsonToCsv(items) {
  if (!items.length) return '';
  const keys = Object.keys(items[0]);
  const escape = val => {
    if (val == null) return '';
    let s = String(val).replace(/"/g, '""');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      s = `"${s}"`;
    }
    return s;
  };
  const header = keys.join(',');
  const rows = items.map(item =>
    keys.map(k => escape(item[k])).join(',')
  );
  return [header, ...rows].join('\n');
}

// 2. Lecture du JSON filtré
const raw      = fs.readFileSync(INPUT_FILE, 'utf8');
const filtered = JSON.parse(raw);

// 3. Génération de ekap-full.csv (toutes les colonnes)
fs.writeFileSync(FULL_CSV_FILE, jsonToCsv(filtered), 'utf8');
console.log(`✅ ${path.basename(FULL_CSV_FILE)} généré.`);

// 4a. projects.csv
const projects = filtered.map(item => ({
  ikn: item['IKN'],
  name: item['İhale Adı'],
  approval_date: item['İhale Onay Tarihi'],
  location: item['IhaleYeri_location'] || '',
  datetime: item['IhaleYeri_datetime'] || '',
  ilk: item['İlk_parsed'],
  estimate: item['Yaklaşık Maliyet_parsed'],
  lowest_bid: item['En Düşük Teklif_parsed'],
  highest_bid: item['En Yüksek Teklif_parsed'],
  pct_lowest_vs_estimate: item['pct_lowest_vs_estimate'],
  pct_bid_spread: item['pct_bid_spread']
}));
fs.writeFileSync(
  path.join(NEO4J_DIR, 'projects.csv'),
  jsonToCsv(projects),
  'utf8'
);
console.log('✅ projects.csv généré.');

// 4b. administrations.csv (contractantes)
const adminsSet = new Set(
  filtered
    .map(item => item['İhaleyi Yapan İdare Adı'])
    .filter(name => name && name.trim())
);
const administrations = Array.from(adminsSet).map(name => ({ name }));
fs.writeFileSync(
  path.join(NEO4J_DIR, 'administrations.csv'),
  jsonToCsv(administrations),
  'utf8'
);
console.log('✅ administrations.csv généré.');

// 4c. admin_sup.csv (Bağlı Olduğu En Üst İdare)
const supSet = new Set(
  filtered
    .map(item => item['Bağlı Olduğu En Üst İdare'])
    .filter(name => name && name.trim())
);
const adminSup = Array.from(supSet).map(name => ({ name }));
fs.writeFileSync(
  path.join(NEO4J_DIR, 'admin_sup.csv'),
  jsonToCsv(adminSup),
  'utf8'
);
console.log('✅ admin_sup.csv généré.');

// 4d. admin_int.csv (Bağlı Olduğu İdare)
const intSet = new Set(
  filtered
    .map(item => item['Bağlı Olduğu İdare'])
    .filter(name => name && name.trim())
);
const adminInt = Array.from(intSet).map(name => ({ name }));
fs.writeFileSync(
  path.join(NEO4J_DIR, 'admin_int.csv'),
  jsonToCsv(adminInt),
  'utf8'
);
console.log('✅ admin_int.csv généré.');

// 4e. procedures.csv
const procsSet = new Set(
  filtered
    .map(item => item['İhale Türü - Usulü'])
    .filter(p => p && p.trim())
);
const procedures = Array.from(procsSet).map(type => ({ type }));
fs.writeFileSync(
  path.join(NEO4J_DIR, 'procedures.csv'),
  jsonToCsv(procedures),
  'utf8'
);
console.log('✅ procedures.csv généré.');

// 5. relations.csv (SUPERVISE, DELEGUE, A_ATTRIBUE, UTILISE_PROCÉDURE)
const relations = [];
filtered.forEach(item => {
  const sup = item['Bağlı Olduğu En Üst İdare']?.trim();
  const inter = item['Bağlı Olduğu İdare']?.trim();
  const contractant = item['İhaleyi Yapan İdare Adı'];

  // SUPERVISE: AdminSup → AdminInt
  if (sup && inter) {
    relations.push({
      source_label: 'AdminSup',
      source_id: sup,
      target_label: 'AdminInt',
      target_id: inter,
      relation_type: 'SUPERVISE'
    });
  }

  // DELEGUE: AdminInt (or AdminSup if no intermediate) → Administration
  const delSource = inter || sup;
  if (delSource && contractant) {
    relations.push({
      source_label: 'AdminInt',
      source_id: delSource,
      target_label: 'Administration',
      target_id: contractant,
      relation_type: 'DELEGUE'
    });
  }

  // A_ATTRIBUE: Administration → Project
  relations.push({
    source_label: 'Administration',
    source_id: contractant,
    target_label: 'Project',
    target_id: item['IKN'],
    relation_type: 'A_ATTRIBUE'
  });

  // UTILISE_PROCÉDURE: Project → Procedure
  relations.push({
    source_label: 'Project',
    source_id: item['IKN'],
    target_label: 'Procedure',
    target_id: item['İhale Türü - Usulü'],
    relation_type: 'UTILISE_PROCÉDURE'
  });
});

fs.writeFileSync(
  path.join(NEO4J_DIR, 'relations.csv'),
  jsonToCsv(relations),
  'utf8'
);
console.log('✅ relations.csv généré.');

console.log(`\nTous les CSV sont prêts :
 • ${FULL_CSV_FILE}
 • ${NEO4J_DIR}/projects.csv
 • ${NEO4J_DIR}/administrations.csv
 • ${NEO4J_DIR}/admin_sup.csv
 • ${NEO4J_DIR}/admin_int.csv
 • ${NEO4J_DIR}/procedures.csv
 • ${NEO4J_DIR}/relations.csv
`);
