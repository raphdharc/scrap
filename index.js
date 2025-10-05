const fs = require('fs');
const path = require('path');
const { runInitialScraper } = require('./src/initial-scraper');
const { runFullScraper } = require('./src/full-scraper');
const { cleanData } = require('./src/cleaner');
const { filterData } = require('./src/filter');
const { exportToCsv } = require('./src/exporter');

// Load configuration
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Ensure data directory exists
const dataDir = path.join(__dirname, config.dataDir);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function main() {
  try {
    console.log('--- Starting EKAP Scraper ---');

    // --- Step 1: Initial Scrape ---
    const initialDataPath = path.join(dataDir, 'initial-scrape.json');
    let initialData;
    if (fs.existsSync(initialDataPath)) {
      console.log('📦 Loading initial scrape data from cache...');
      initialData = JSON.parse(fs.readFileSync(initialDataPath, 'utf8'));
    } else {
      initialData = await runInitialScraper(config);
      fs.writeFileSync(initialDataPath, JSON.stringify(initialData, null, 2), 'utf8');
      console.log(`💾 Initial scrape data saved to ${initialDataPath}`);
    }

    const iknList = initialData.map(item => item.ikn);
    console.log(`Found ${iknList.length} IKNs to process.`);

    // --- Step 2: Full Scrape ---
    const fullScrapePath = path.join(dataDir, 'full-scrape.json');
    let fullData;
    if (fs.existsSync(fullScrapePath)) {
        console.log('📦 Loading full scrape data from cache...');
        fullData = JSON.parse(fs.readFileSync(fullScrapePath, 'utf8'));
    } else {
        fullData = await runFullScraper(iknList, config);
        fs.writeFileSync(fullScrapePath, JSON.stringify(fullData, null, 2), 'utf8');
        console.log(`💾 Full scrape data saved to ${fullScrapePath}`);
    }

    // --- Step 3: Clean Data ---
    const cleanedData = cleanData(fullData);
    const cleanedDataPath = path.join(dataDir, 'cleaned-data.json');
    fs.writeFileSync(cleanedDataPath, JSON.stringify(cleanedData, null, 2), 'utf8');
    console.log(`🧼 Data cleaned and saved to ${cleanedDataPath}`);

    // --- Step 4: Filter Data ---
    const filteredData = filterData(cleanedData);
    const filteredDataPath = path.join(dataDir, 'filtered-data.json');
    fs.writeFileSync(filteredDataPath, JSON.stringify(filteredData, null, 2), 'utf8');
    console.log(`🔍 Data filtered and saved to ${filteredDataPath}`);

    // --- Step 5: Export Data ---
    exportToCsv(filteredData, config);
    console.log('--- Scraper Finished Successfully ---');

  } catch (error) {
    console.error('❌ An error occurred during the scraping process:', error);
    process.exit(1);
  }
}

main();