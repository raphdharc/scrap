/**
 * export-csv.js
 * Génère :
 * - projects.csv : export global des projets filtrés
 * - neo4j/ : fichiers pour import dans Neo4j (projects, admins, contractors, locations)
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('json2csv');

const INPUT_FILE = path.join(__dirname, 'ekap-filtered.json');
const OUTPUT_MAIN = path.join(__dirname, 'projects.csv');
const OUTPUT_DIR = path.join(__dirname, 'neo4j');

// Création du dossier Neo4j s’il n’existe pas
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// Lecture du fichier filtré
const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

// === CSV global ===
const projectRows = data.map(item => ({
  ikn: item['IKN'] || '',
  procedure: item['İhale Türü - Usulü'] || '',
  status: item['İhale Durumu'] || '',
  location: item['İhale Yeri'] || '',
  datetime: item['İhale Tarihi'] || '',
  estimate: item['Yaklaşık Maliyet_parsed'] || '',
  lowest_bid: item['En Düşük Teklif_parsed'] || '',
  highest_bid: item['En Yüksek Teklif_parsed'] || '',
}));

const csv = parse(projectRows);
fs.writeFileSync(OUTPUT_MAIN, csv, 'utf8');
console.log(`✅ Fichier CSV principal généré : ${OUTPUT_MAIN}`);

// === Export Neo4j ===
const nodes = {
  projects: [],
  admins: [],
  contractors: [],
  locations: [],
};

data.forEach(item => {
  nodes.projects.push({
    ikn: item['IKN'],
    name: item['İşin Adı'] || '',
    estimate: item['Yaklaşık Maliyet_parsed'] || '',
    lowest_bid: item['En Düşük Teklif_parsed'] || '',
    highest_bid: item['En Yüksek Teklif_parsed'] || '',
  });

  if (item['İdare Adı']) {
    nodes.admins.push({ name: item['İdare Adı'] });
  }

  if (item['İhale Yeri']) {
    nodes.locations.push({ name: item['İhale Yeri'] });
  }

  if (item['Üzerine İhale Yapılan']) {
    nodes.contractors.push({ name: item['Üzerine İhale Yapılan'] });
  }
});

// Écriture des fichiers Neo4j
for (const [key, entries] of Object.entries(nodes)) {
  if (entries.length === 0) {
    console.log(`⚠️ Neo4j : ${key}.csv ignoré (aucune donnée)`);
    continue;
  }

  const outPath = path.join(OUTPUT_DIR, `${key}.csv`);
  const csvText = parse(entries);
  fs.writeFileSync(outPath, csvText, 'utf8');
  console.log(`✅ Neo4j : ${key}.csv généré`);
}

