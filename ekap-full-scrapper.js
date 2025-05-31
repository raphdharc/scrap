const { chromium } = require('playwright');
const fs = require('fs');

async function waitForDynamicContent(page, timeout = 5000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
    await page.waitForTimeout(500);
  } catch (e) {
    console.log('⚠️ Timeout en attendant le chargement dynamique');
  }
}

async function findCardByText(page, searchText) {
  const cards = await page.$$('div.card.text-justify');
  console.log(`🔍 Recherche de "${searchText}" dans ${cards.length} cartes`);

  for (const card of cards) {
    const ikn = await card.$eval('h6.text-warning', el => el.textContent.trim())
      .catch(() => null);

    if (!ikn) continue;

    const cleanIkn = ikn.replace(/\s+/g, '').replace(/^.*?(\d{4}\/\d+).*?$/, '$1');
    console.log(`📋 IKN trouvé dans la carte: "${cleanIkn}"`);

    if (cleanIkn === searchText) {
      console.log(`✅ Correspondance trouvée !`);
      return card;
    }
  }

  const allIkns = await page.$$eval('div.card.text-justify h6.text-warning', 
    elements => elements.map(el => el.textContent.trim()
      .replace(/\s+/g, '')
      .replace(/^.*?(\d{4}\/\d+).*?$/, '$1')
    )
  );
  
  console.log('📊 Tous les IKNs sur la page:', allIkns);
  return null;
}

async function clickWithRetry(element, maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await element.click();
      return true;
    } catch (e) {
      if (i === maxAttempts - 1) throw e;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return false;
}

async function applyFilters(page) {
  console.log("🔄 Application des filtres...");
  await page.selectOption('select[title="İKN Yılı seçiniz"]', '2023');
  await page.waitForTimeout(500);
  
  await page.selectOption(
    'select[title="İhalenin yapıldığı il"]',
    { label: 'HATAY' }
  );
  await page.waitForTimeout(500);
  
  await page.click('label:has-text("Yapım")');
  await page.waitForTimeout(500);
  
  await page.click('#pnlFiltreBtn button');
  await waitForDynamicContent(page);
}

async function scrapeTabData(frame, tabSelector, tableSelector, timeout = 10000) {
  console.log(`📑 Extraction des données de l'onglet ${tabSelector}...`);
  
  try {
    if (tabSelector.includes('Sozlesme')) {
      const sozlesmeTab = await frame.$('ul.nav.nav-tabs a[href="#tabSozlesmeBilgi"]');
      if (!sozlesmeTab) {
        console.log('⚠️ Onglet Sözleşme non trouvé - marqué comme N/A');
        return { "Sözleşme Bilgileri": "N/A" };
      }
    }

    for (let i = 0; i < 3; i++) {
      try {
        if (tabSelector.includes('Sozlesme')) {
          await frame.click('ul.nav.nav-tabs a[href="#tabSozlesmeBilgi"]');
        } else {
          await frame.click(tabSelector);
        }
        break;
      } catch (e) {
        if (i === 2) {
          if (tabSelector.includes('Sozlesme')) {
            console.log('⚠️ Impossible de cliquer sur l\'onglet Sözleşme - marqué comme N/A');
            return { "Sözleşme Bilgileri": "N/A" };
          }
          throw e;
        }
        await frame.waitForTimeout(500);
      }
    }

    await frame.waitForTimeout(500);

    if (tabSelector.includes('Sozlesme')) {
      const sectionExists = await frame.waitForSelector('section#tabSozlesmeBilgi', { 
        timeout,
        state: 'visible'
      }).catch(() => null);

      if (!sectionExists) {
        console.log('⚠️ Section Sözleşme non trouvée - marqué comme N/A');
        return { "Sözleşme Bilgileri": "N/A" };
      }
      
      return await frame.$$eval('section#tabSozlesmeBilgi .sozlesmeCard .card-block .card-text.clear',
        elements => {
          if (!elements.length) return { "Sözleşme Bilgileri": "N/A" };
          const data = {};
          for (const el of elements) {
            const label = el.querySelector('span.sozLabel b').textContent.trim();
            const value = el.querySelector('span:nth-child(2)').textContent.trim();
            data[label] = value;
          }
          return data;
        }
      );
    } else {
      await frame.waitForSelector(tableSelector, { timeout });
      return await frame.$$eval(tableSelector,
        rows => Object.fromEntries(
          rows.map(r => {
            const key = r.querySelector('td:first-child span').textContent.trim();
            const value = r.querySelector('td:nth-child(2) span, td:nth-child(2)').textContent.trim();
            return [key, value];
          })
        )
      );
    }
  } catch (error) {
    console.log(`⚠️ Erreur lors de l'extraction de ${tabSelector}:`, error.message);
    if (tabSelector.includes('Sozlesme')) {
      return { "Sözleşme Bilgileri": "N/A" };
    }
    return {};
  }
}

(async () => {
  const existingData = JSON.parse(fs.readFileSync('ekap-hatay-2023.json', 'utf8'));
  const iknList = existingData.map(item => item.ikn);
  
  console.log(`🎯 Total d'appels d'offres à traiter: ${iknList.length}`);

  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 50
  });
  const page = await browser.newPage();

  await page.goto('https://ekap.kik.gov.tr/EKAP/Ortak/IhaleArama/index.html', {
    waitUntil: 'networkidle',
    timeout: 10000
  });

  const detailed = [];
  let processedCount = 0;

  await applyFilters(page);

  for (const ikn of iknList) {
    processedCount++;
    console.log(`\n==== 📄 Traitement de l'IKN: ${ikn} (${processedCount}/${iknList.length}) ====`);
    
    try {
      const currentYear = await page.$eval('select[title="İKN Yılı seçiniz"]', el => el.value);
      const currentCity = await page.$eval('select[title="İhalenin yapıldığı il"]', el => el.value);
      console.log(`🔍 Filtres actuels - Année: ${currentYear}, Ville: ${currentCity}`);

      await page.waitForSelector('div.card.text-justify', { timeout: 5000 });
      await waitForDynamicContent(page);

      const totalCards = await page.$$eval('div.card.text-justify', cards => cards.length);
      console.log(`📊 Nombre total de cartes: ${totalCards}`);

      if (totalCards === 0) {
        console.log('⚠️ Aucune carte trouvée, passage à l\'IKN suivant');
        continue;
      }

      const card = await findCardByText(page, ikn);
      if (!card) {
        console.log(`⚠️ Carte non trouvée pour IKN ${ikn}`);
        continue;
      }

      const button = await card.$('button.btn-outline-info');
      if (!button) {
        console.log(`⚠️ Bouton non trouvé pour IKN ${ikn}`);
        continue;
      }

      await clickWithRetry(button);
      await waitForDynamicContent(page);

      const frameHandle = await page.waitForSelector(
        'iframe[src*="BirBakistaIhale.aspx"]',
        { timeout: 5000 }
      );
      const frame = await frameHandle.contentFrame();
      await frame.waitForLoadState('networkidle');

      const ihale = await scrapeTabData(frame, 'a[href="#tabIhaleBilgi"]', 'section#tabIhaleBilgi table.bilgi tr');
      const idare = await scrapeTabData(frame, 'a[href="#tabIdareBilgi"]', 'section#tabIdareBilgi table.bilgi tr');
      const sozlesme = await scrapeTabData(frame, 'a[href="#tabSozlesmeBilgi"]', 'div.sozlesmeCard p.card-text.clear');

      const html = await frame.content();
      const safeFileName = ikn.replace('/', '_');
      fs.writeFileSync(`debug-detail-${safeFileName}.html`, html);

      detailed.push({
        IKN: ikn,
        ...ihale,
        ...idare,
        ...sozlesme
      });

      // Fermer la modal avec retry - Version optimisée
      for (let i = 0; i < 3; i++) {
        try {
          const closeButton = await card.$('div.card-footer.list-complete-item button.close');
          if (!closeButton) {
            console.log('⚠️ Bouton de fermeture non trouvé dans la carte');
            break;
          }
          await closeButton.click();
          await page.waitForTimeout(300);
          break;
        } catch (e) {
          if (i === 2) {
            console.log('⚠️ Échec de la fermeture après 3 tentatives');
            break;
          }
          await page.waitForTimeout(500);
        }
      }

      // Sauvegarde régulière
      if (processedCount % 10 === 0) {
        fs.writeFileSync('ekap-results.json', JSON.stringify(detailed, null, 2));
        console.log(`💾 Sauvegarde intermédiaire effectuée (${processedCount}/${iknList.length})`);
      }

      // Petit délai entre les appels d'offres
      await page.waitForTimeout(300);

    } catch (error) {
      console.log(`❌ Erreur pour IKN ${ikn}:`, error.message);
      try {
        const card = await findCardByText(page, ikn);
        if (card) {
          const closeButton = await card.$('div.card-footer.list-complete-item button.close');
          if (closeButton) {
            await closeButton.click();
            await page.waitForTimeout(300);
          }
        }
      } catch (e) {}
    }
  }

  fs.writeFileSync('ekap-results.json', JSON.stringify(detailed, null, 2));
  console.log(`\n✅ Terminé ! ${detailed.length}/${iknList.length} appels d'offres traités`);

  await browser.close();
})();