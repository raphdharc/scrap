const { chromium } = require('playwright');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { solveCaptcha } = require('./captcha-solver');

// --- Helper Functions ---

async function waitForDynamicContent(page, timeout = 5000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
    await page.waitForTimeout(500);
  } catch (e) {
    console.log('⚠️ Timeout waiting for dynamic content.');
  }
}

async function findCardByText(page, searchText) {
  const cards = await page.$$('div.card.text-justify');
  console.log(`🔍 Searching for "${searchText}" in ${cards.length} cards...`);

  for (const card of cards) {
    const iknRaw = await card.$eval('h6.text-warning', el => el.textContent.trim()).catch(() => null);
    if (!iknRaw) continue;

    const cleanIkn = iknRaw.replace(/\s+/g, '').replace(/^.*?(\d{4}\/\d+).*?$/, '$1');
    if (cleanIkn === searchText) {
      console.log(`✅ Match found for IKN: "${cleanIkn}"`);
      return card;
    }
  }
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

async function applyFilters(page, config) {
  console.log("🔄 Applying filters...");
  await page.selectOption('select[title="İKN Yılı seçiniz"]', String(config.search.iknYil));
  await page.waitForTimeout(500);

  await page.selectOption(
    'select[title="İhalenin yapıldığı il"]',
    { label: config.search.ilLabel }
  );
  await page.waitForTimeout(500);

  await page.click('label:has-text("Yapım")');
  await page.waitForTimeout(500);

  await page.click('#pnlFiltreBtn button');
  await waitForDynamicContent(page);
}

async function scrapeTabData(frame, tabSelector, tableSelector, timeout = 10000) {
  console.log(`📑 Extracting data from tab ${tabSelector}...`);
  try {
    // Special handling for the contract tab (Sözleşme) which may not exist
    if (tabSelector.includes('Sozlesme')) {
      const sozlesmeTab = await frame.$('ul.nav.nav-tabs a[href="#tabSozlesmeBilgi"]');
      if (!sozlesmeTab) {
        console.log('⚠️ Contract tab not found - marking as N/A');
        return { "Sözleşme Bilgileri": "N/A" };
      }
      await frame.click('ul.nav.nav-tabs a[href="#tabSozlesmeBilgi"]');
    } else {
      await frame.click(tabSelector);
    }
    await frame.waitForTimeout(500);

    // Scrape contract data
    if (tabSelector.includes('Sozlesme')) {
      const sectionExists = await frame.waitForSelector('section#tabSozlesmeBilgi', { timeout, state: 'visible' }).catch(() => null);
      if (!sectionExists) return { "Sözleşme Bilgileri": "N/A" };
      return await frame.$$eval('section#tabSozlesmeBilgi .sozlesmeCard .card-block .card-text.clear', elements => {
        if (!elements.length) return { "Sözleşme Bilgileri": "N/A" };
        const data = {};
        elements.forEach(el => {
          const label = el.querySelector('span.sozLabel b')?.textContent.trim();
          const value = el.querySelector('span:nth-child(2)')?.textContent.trim();
          if (label) data[label] = value;
        });
        return data;
      });
    }
    // Scrape data from other tables
    else {
      await frame.waitForSelector(tableSelector, { timeout });
      return await frame.$$eval(tableSelector, rows => Object.fromEntries(
        rows.map(r => {
          const key = r.querySelector('td:first-child span')?.textContent.trim();
          const value = r.querySelector('td:nth-child(2) span, td:nth-child(2)')?.textContent.trim();
          return [key, value];
        })
      ));
    }
  } catch (error) {
    console.log(`⚠️ Error extracting from ${tabSelector}:`, error.message);
    return tabSelector.includes('Sozlesme') ? { "Sözleşme Bilgileri": "N/A" } : {};
  }
}

function waitForCaptchaSolved() {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('🛑 CAPTCHA: Please solve the captcha in the browser, then press Enter here to continue…', () => {
      rl.close();
      resolve();
    });
  });
}

async function scrapeIlanPreviewFromModal(page) {
  console.log('📑 Extracting data from modal iframe...');
  const iframeHandle = await page.waitForSelector('iframe#ifr', { timeout: 10000 });
  const frame = await iframeHandle.contentFrame();
  if (!frame) throw new Error('❌ Could not access iframe content');

  await frame.waitForSelector('#ilanOnizleme .ilanTabloStil', { timeout: 10000 });
  const rows = await frame.$$eval('#ilanOnizleme .ilanTabloStil > tbody > tr', trs =>
    trs.map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()).filter(Boolean))
       .filter(row => row.length > 0)
  );

  const ilanData = {};
  for (const row of rows) {
    if (row.length >= 2) ilanData[row[0]] = row.slice(1).join(' ');
  }
  return ilanData;
}

// --- Main Scraper Function ---

async function runFullScraper(iknList, config) {
  console.log(`🎯 Total tenders to process: ${iknList.length}`);

  const browser = await chromium.launch({
    headless: config.headless,
    slowMo: 50
  });
  const page = await browser.newPage();
  await page.goto('https://ekap.kik.gov.tr/EKAP/Ortak/IhaleArama/index.html', { waitUntil: 'networkidle' });

  const detailedResults = [];
  let processedCount = 0;
  let captchaDone = false;

  await applyFilters(page, config);

  for (const ikn of iknList) {
    processedCount++;
    console.log(`\n==== 📄 Processing IKN: ${ikn} (${processedCount}/${iknList.length}) ====`);

    try {
      await page.waitForSelector('div.card.text-justify', { timeout: 5000 });
      await waitForDynamicContent(page);

      const card = await findCardByText(page, ikn);
      if (!card) {
        console.log(`⚠️ Card not found for IKN ${ikn}, skipping.`);
        continue;
      }

      const button = await card.$('button.btn-outline-info');
      if (!button) {
        console.log(`⚠️ Details button not found for IKN ${ikn}, skipping.`);
        continue;
      }

      await clickWithRetry(button);
      await waitForDynamicContent(page);

      const frameHandle = await page.waitForSelector('iframe[src*="BirBakistaIhale.aspx"]', { timeout: 5000 });
      const frame = await frameHandle.contentFrame();
      await frame.waitForLoadState('networkidle');

      const ihale = await scrapeTabData(frame, 'a[href="#tabIhaleBilgi"]', 'section#tabIhaleBilgi table.bilgi tr');
      const idare = await scrapeTabData(frame, 'a[href="#tabIdareBilgi"]', 'section#tabIdareBilgi table.bilgi tr');
      const sozlesme = await scrapeTabData(frame, 'a[href="#tabSozlesmeBilgi"]', 'div.sozlesmeCard p.card-text.clear');

      let ilanBilgileri = { "İlan Bilgileri": "N/A" };
      try {
        console.log('🧭 Navigating to tender notice tab...');
        await frame.click('a[href="#tabIlanBilgi"]');
        await frame.waitForTimeout(500);
        await frame.click('#ucBirBakistaIhale_dataListSonucTarihleri_ctl00_lnkNav');

        const modalIframeHandle = await page.waitForSelector('iframe#ifr', { timeout: 10000 });
        const modalFrame = await modalIframeHandle.contentFrame();
        const captchaImage = await modalFrame.$('img#imgDogrulama');

        if (captchaImage && !captchaDone) {
          if (config.captcha.autoSolve && config.captcha.apiKey && config.captcha.apiKey !== 'YOUR_API_KEY_HERE') {
            console.log('🤖 Attempting to auto-solve CAPTCHA...');
            const captchaPath = path.join(__dirname, '..', config.dataDir, 'captcha.png');
            await captchaImage.screenshot({ path: captchaPath });
            const captchaText = await solveCaptcha(config.captcha.apiKey, captchaPath);

            if (captchaText) {
              await modalFrame.type('#txtDogrulamaKodu', captchaText);
              await modalFrame.click('#btnGonder');
              await page.waitForTimeout(2000); // Wait for submission
              console.log('✅ CAPTCHA submitted automatically.');
              captchaDone = true;
            } else {
              console.log('⚠️ Auto-solve failed, falling back to manual input.');
              await waitForCaptchaSolved();
              captchaDone = true;
            }
          } else {
            await waitForCaptchaSolved();
            captchaDone = true;
          }
        }

        ilanBilgileri = await scrapeIlanPreviewFromModal(page);

        console.log('🧹 Closing tender notice modal...');
        await page.click('div.modal-dialog.modal-lg button.close');
        await page.waitForTimeout(300);

      } catch (e) {
        console.log(`⚠️ Failed to extract tender notice for ${ikn}: ${e.message}`);
        const closeButton = await page.$('div.modal-dialog.modal-lg button.close');
        if (closeButton) await closeButton.click();
      }

      detailedResults.push({ IKN: ikn, ...ihale, ...idare, ...sozlesme, ...ilanBilgileri });

      // Close the main card modal
      const closeButton = await page.$('div.modal-header button.close');
      if(closeButton) await closeButton.click();
      await page.waitForTimeout(500);

    } catch (error) {
      console.log(`❌ Error processing IKN ${ikn}:`, error.message);
    }
  }

  console.log(`\n✅ Finished! ${detailedResults.length}/${iknList.length} tenders processed.`);
  await browser.close();
  return detailedResults;
}

module.exports = { runFullScraper };