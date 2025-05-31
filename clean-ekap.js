/**
 * clean-ekap.js
 * Script de nettoyage des données EKAP post-séisme Hatay 2023.
 * - Conserve toutes les clés originales
 * - Ajoute des champs *_parsed pour les montants
 * - Calcule pct_lowest_vs_estimate et pct_bid_spread
 * - Sépare "İhale Yeri - Tarihi - Saati" en IhaleYeri_location et IhaleYeri_datetime
 */

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'ekap-results.json');
const OUTPUT_FILE = path.join(__dirname, 'ekap-cleaned.json');

/**
 * Convertit une chaîne de type "1.234.567,89 TRY" en float (1234567.89).
 * Renvoie null pour les valeurs non numériques ou vides.
 */
function parseTRY(str) {
  if (!str || !/[0-9]/.test(str)) return null;
  return parseFloat(
    str
      .replace(/\./g, '')        // supprimer séparateurs de milliers
      .replace(',', '.')         // virgule → point décimal
      .replace(/\s*TRY$/i, '')   // retirer le code devise
      .trim()
  );
}

/**
 * Sépare la chaîne "Lieu - DD.MM.YYYY HH:MM" en deux champs.
 * Renvoie un objet { IhaleYeri_location, IhaleYeri_datetime } ou {} si échec.
 */
function splitLocationDatetime(locStr) {
  if (!locStr || typeof locStr !== 'string') return {};
  const parts = locStr.split(' - ');
  if (parts.length < 2) return {};
  const datetime = parts.pop().trim();
  const location = parts.join(' - ').trim();
  return { IhaleYeri_location: location, IhaleYeri_datetime: datetime };
}

/**
 * Nettoie et enrichit la liste des appels d'offres.
 */
function cleanTenders(tenders) {
  return tenders.map(item => {
    const out = { ...item };

    // 1. Parsing dynamique des champs monétaires
    const moneyFields = ['İlk', 'Yaklaşık Maliyet', 'En Düşük Teklif', 'En Yüksek Teklif'];
    const parsed = {};
    moneyFields.forEach(field => {
      parsed[field] = parseTRY(item[field]);
      out[`${field}_parsed`] = parsed[field];
    });

    const estimate   = parsed['Yaklaşık Maliyet'];
    const lowestBid  = parsed['En Düşük Teklif'];
    const highestBid = parsed['En Yüksek Teklif'];

    // 2. Indicateur corruption 1 : % lowest vs estimate
    out['pct_lowest_vs_estimate'] =
      estimate != null && lowestBid != null
        ? ((lowestBid - estimate) / estimate) * 100
        : null;

    // 3. Indicateur corruption 2 : bid spread
    out['pct_bid_spread'] =
      lowestBid != null && highestBid != null
        ? ((highestBid - lowestBid) / lowestBid) * 100
        : null;

    // 4. Scission du champ "İhale Yeri - Tarihi - Saati"
    const locStr = item['İhale Yeri - Tarihi - Saati'];
    const split = splitLocationDatetime(locStr);
    if (split.IhaleYeri_location) out['IhaleYeri_location'] = split.IhaleYeri_location;
    if (split.IhaleYeri_datetime) out['IhaleYeri_datetime'] = split.IhaleYeri_datetime;

    return out;
  });
}

/**
 * Point d'entrée du script.
 */
function main() {
  try {
    const raw = fs.readFileSync(INPUT_FILE, 'utf8');
    const tenders = JSON.parse(raw);
    const cleaned = cleanTenders(tenders);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cleaned, null, 2), 'utf8');
    console.log(`✅ ${OUTPUT_FILE} généré avec succès.`);
  } catch (err) {
    console.error('❌ Erreur lors du nettoyage des données EKAP :', err);
    process.exit(1);
  }
}

main();
