const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify/sync');

function exportToCsv(data, config) {
  const outputMain = path.join(config.dataDir, 'projects.csv');
  const outputDirNeo4j = path.join(config.dataDir, 'neo4j');

  if (!fs.existsSync(outputDirNeo4j)) {
    fs.mkdirSync(outputDirNeo4j, { recursive: true });
  }

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

  const csv = stringify(projectRows, { header: true });
  fs.writeFileSync(outputMain, csv, 'utf8');
  console.log(`✅ Fichier CSV principal généré : ${outputMain}`);

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
    const uniqueEntries = [...new Map(entries.map(item => [item.name, item])).values()];
    const outPath = path.join(outputDirNeo4j, `${key}.csv`);
    const csvText = stringify(uniqueEntries, { header: true });
    fs.writeFileSync(outPath, csvText, 'utf8');
    console.log(`✅ Neo4j : ${key}.csv généré`);
  }
}

module.exports = { exportToCsv };