const { chromium } = require('playwright');
const fs = require('fs');
const readline = require('readline');

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
    const iknRaw = await card.$eval('h6.text-warning', el => el.textContent.trim()).catch(() => null);
    if (!iknRaw) continue;

    const cleanIkn = iknRaw.replace(/\s+/g, '').replace(/^.*?(\d{4}\/\d+).*?$/, '$1');
    if (cleanIkn === searchText) {
      console.log(`📋 IKN trouvé dans la carte: "${cleanIkn}"`);
      console.log('✅ Correspondance trouvée !');
      return card;
    }
  }

  const allIkns = await page.$$eval(
    'div.card.text-justify h6.text-warning',
    elements => elements
      .map(el => el.textContent.trim()
        .replace(/\s+/g, '')
        .replace(/^.*?(\d{4}\/\d+).*?$/, '$1')
      )
  );
  console.log('📊 Aucun match direct. Tous les IKNs sur la page:', allIkns);
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

      return await frame.$$eval(
        'section#tabSozlesmeBilgi .sozlesmeCard .card-block .card-text.clear',
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

function waitForCaptchaSolved() {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('🛑 Résous le captcha dans le navigateur, puis appuie sur Entrée ici…', () => {
      rl.close();
      resolve();
    });
  });
}

async function scrapeIlanPreviewFromModal(page) {
  console.log('📑 Extraction des données depuis l’iframe du modal…');

  // Attendre l’iframe du modal İlan Önizleme
  const iframeHandle = await page.waitForSelector('iframe#ifr', { timeout: 10000 });
  const frame = await iframeHandle.contentFrame();
  if (!frame) throw new Error('❌ Impossible d’accéder au contenu de l’iframe');

  // Attendre le tableau #ilanOnizleme
  await frame.waitForSelector('#ilanOnizleme .ilanTabloStil', { timeout: 10000 });

  // Récupérer chaque ligne <tr>, transformer en tableau de cellules
  const rows = await frame.$$eval(
    '#ilanOnizleme .ilanTabloStil > tbody > tr',
    trs => trs
      .map(tr => {
        const cells = Array.from(tr.querySelectorAll('td'));
        return cells.map(td => td.textContent.trim()).filter(Boolean);
      })
      .filter(row => row.length > 0)
  );

  // Construire un objet { clé: valeur }
  const ilanData = {};
  for (const row of rows) {
    if (row.length >= 2) {
      ilanData[row[0]] = row.slice(1).join(' ');
    }
  }

  return ilanData;
}

(async () => {
  const existingData = JSON.parse(
    fs.readFileSync('ekap-hatay-2023.json', 'utf8')
  );
  // Suppression de la limitation aux 3 premiers, on prend tous les IKN
  const iknList = existingData.map(item => item.ikn);

  console.log(`🎯 Total d'appels d'offres à traiter: ${iknList.length}`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50
  });
  const page = await browser.newPage();

  await page.goto(
    'https://ekap.kik.gov.tr/EKAP/Ortak/IhaleArama/index.html',
    {
      waitUntil: 'networkidle',
      timeout: 10000
    }
  );

  const detailed = [];
  let processedCount = 0;
  let captchaDone = false; // Captcha manuel une seule fois

  await applyFilters(page);

  for (const ikn of iknList) {
    processedCount++;
    console.log(`\n==== 📄 Traitement de l'IKN: ${ikn} (${processedCount}/${iknList.length}) ====`);

    try {
      const currentYear = await page.$eval(
        'select[title="İKN Yılı seçiniz"]',
        el => el.value
      );
      const currentCity = await page.$eval(
        'select[title="İhalenin yapıldığı il"]',
        el => el.value
      );
      console.log(`🔍 Filtres actuels - Année: ${currentYear}, Ville: ${currentCity}`);

      await page.waitForSelector('div.card.text-justify', { timeout: 5000 });
      await waitForDynamicContent(page);

      const totalCards = await page.$$eval(
        'div.card.text-justify',
        cards => cards.length
      );
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

      // Extraction des onglets existants : Ihale, Idare, Sozlesme
      const ihale = await scrapeTabData(
        frame,
        'a[href="#tabIhaleBilgi"]',
        'section#tabIhaleBilgi table.bilgi tr'
      );
      const idare = await scrapeTabData(
        frame,
        'a[href="#tabIdareBilgi"]',
        'section#tabIdareBilgi table.bilgi tr'
      );
      const sozlesme = await scrapeTabData(
        frame,
        'a[href="#tabSozlesmeBilgi"]',
        'div.sozlesmeCard p.card-text.clear'
      );

      // → Intégration de "İlan Bilgileri" pour chaque IKN (captcha manuel une seule fois)
      let ilanBilgileri = { "İlan Bilgileri": "N/A" };
      try {
        console.log('🧭 Navigation vers l’onglet İlan Bilgileri...');
        await frame.click('a[href="#tabIlanBilgi"]');
        await frame.waitForTimeout(500);

        await frame.waitForSelector(
          '#ucBirBakistaIhale_dataListSonucTarihleri_ctl00_lnkNav',
          { timeout: 5000 }
        );
        await frame.click('#ucBirBakistaIhale_dataListSonucTarihleri_ctl00_lnkNav');

        // Si captcha pas encore fait, pause manuelle
        if (!captchaDone) {
          await waitForCaptchaSolved();
          captchaDone = true;
        }

        // Extraction à l’intérieur de l’iframe du modal
        ilanBilgileri = await scrapeIlanPreviewFromModal(page);

        // Fermeture du modal İlan Önizleme
        try {
          console.log('🧹 Tentative de fermeture du modal İlan Önizleme...');
          await page.waitForSelector('div.modal-dialog.modal-lg button.close', { timeout: 5000 });
          await page.click('div.modal-dialog.modal-lg button.close');
          await page.waitForTimeout(300);
          console.log('✅ Modal İlan Önizleme fermé.');
        } catch (e) {
          console.log('⚠️ Impossible de fermer le modal İlan Önizleme:', e.message);
        }
      } catch (e) {
        console.log(
          `⚠️ Échec de l'extraction de l’onglet İlan Bilgileri pour ${ikn} : ${e.message}`
        );
        ilanBilgileri = { "İlan Bilgileri": "N/A" };
      }

      // Ajout dans l'objet final
      detailed.push({
        IKN: ikn,
        ...ihale,
        ...idare,
        ...sozlesme,
        ...ilanBilgileri
      });

      // Fermeture de la modal principale (celle de la carte)
      for (let i = 0; i < 3; i++) {
        try {
          const closeButton = await card.$(
            'div.card-footer.list-complete-item button.close'
          );
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

      // Sauvegarde intermédiaire
      if (processedCount % 10 === 0) {
        fs.writeFileSync(
          'ekap-results.json',
          JSON.stringify(detailed, null, 2)
        );
        console.log(
          `💾 Sauvegarde intermédiaire effectuée (${processedCount}/${iknList.length})`
        );
      }

      await page.waitForTimeout(300);

    } catch (error) {
      console.log(`❌ Erreur pour IKN ${ikn}:`, error.message);
      try {
        const card = await findCardByText(page, ikn);
        if (card) {
          const closeButton = await card.$(
            'div.card-footer.list-complete-item button.close'
          );
          if (closeButton) {
            await closeButton.click();
            await page.waitForTimeout(300);
          }
        }
      } catch (e) {}
    }
  }

  // Sauvegarde finale
  fs.writeFileSync('ekap-results.json', JSON.stringify(detailed, null, 2));
  console.log(`\n✅ Terminé ! ${detailed.length}/${iknList.length} appels d'offres traités`);

  await browser.close();
})();
