const { chromium } = require('playwright');

async function runInitialScraper(config) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://ekap.kik.gov.tr/EKAP/Ortak/IhaleArama/index.html', { waitUntil: 'load' });

  // TODO: tabId might need to be fetched dynamically.
  const tabId = '8c0495a2-9ae9-4739-8f54-9dcf0c3197f8';
  const allOffers = [];
  let pageIndex = 1;

  console.log('🚀 Starting initial scrape...');

  while (true) {
    const url = `https://ekap.kik.gov.tr/EKAP/Ortak/YeniIhaleAramaData.ashx`
      + `?ES=&pageIndex=${pageIndex}`
      + `&metot=ara`
      + `&tabId=${tabId}`
      + `&ihaleTuru=${config.search.ihaleTuru}`
      + `&ilId=${config.search.ilId}`
      + `&iknYil=${config.search.iknYil}`
      + `&orderBy=8`
      + `&yasaKapsami=1`
      + `&isMobil=0`
      + `&kayitTuru=1`
      + `&totalCount=1`;

    const data = await page.evaluate(async (url) => {
      const res = await fetch(url, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      const text = await res.text();
      if (text.trim().startsWith('<')) {
        console.error('HTML response received instead of JSON. The site may be down or the API may have changed.');
        return null;
      }
      return JSON.parse(text);
    }, url);

    if (!data) break;

    const rawList = data.yeniIhaleAramaResultList;
    if (!Array.isArray(rawList) || rawList.length === 0) break;

    const clean = rawList.map(item => ({
      ikn:   item.E1,
      title: item.E2,
      admin: item.E3,
      date:  item.E6
    }));
    allOffers.push(...clean);

    console.log(`Page ${pageIndex} → ${clean.length} offers`);
    pageIndex++;
  }

  console.log(`\n✅ Total retrieved: ${allOffers.length} offers`);
  await browser.close();
  return allOffers;
}

module.exports = { runInitialScraper };