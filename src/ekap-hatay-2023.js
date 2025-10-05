// o4-ekap-api.js
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(
    'https://ekap.kik.gov.tr/EKAP/Ortak/IhaleArama/index.html',
    { waitUntil: 'load' }
  );

  // REPRIS de DevTools
  const tabId = '8c0495a2-9ae9-4739-8f54-9dcf0c3197f8';
  const allOffers = [];
  let pageIndex = 1;

  while (true) {
    // Construire l'URL complète avec tous les paramètres
    const url = `https://ekap.kik.gov.tr/EKAP/Ortak/YeniIhaleAramaData.ashx`
      + `?ES=&pageIndex=${pageIndex}`
      + `&metot=ara`
      + `&tabId=${tabId}`
      + `&ihaleTuru=2`
      + `&ilId=31`
      + `&iknYil=2023`
      + `&orderBy=8`
      + `&yasaKapsami=1`
      + `&isMobil=0`
      + `&kayitTuru=1`
      + `&totalCount=1`;

    // Lancer le fetch DANS LE CONTEXTE DE LA PAGE pour avoir les cookies et headers automatiques
    const data = await page.evaluate(async (url) => {
      const res = await fetch(url, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      const text = await res.text();
      if (text.trim().startsWith('<')) {
        throw new Error('Réponse HTML reçue au lieu de JSON');
      }
      return JSON.parse(text);
    }, url);

    // Extraire la liste brute
    const rawList = data.yeniIhaleAramaResultList;
    if (!Array.isArray(rawList) || rawList.length === 0) break;

    // Transformer en objets lisibles
    const clean = rawList.map(item => ({
      ikn:   item.E1,
      title: item.E2,
      admin: item.E3,
      date:  item.E6
    }));
    allOffers.push(...clean);

    console.log(`Page ${pageIndex} → ${clean.length} offres`);
    pageIndex++;
  }

  console.log(`\n✅ Total récupéré : ${allOffers.length} appels d’offre`);
  fs.writeFileSync('ekap-hatay-2023.json',
                   JSON.stringify(allOffers, null, 2));

  await browser.close();
})();

