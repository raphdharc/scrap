# EKAP Tender Scraper

This project is a Node.js application designed to scrape public tender information from Turkey's official Electronic Public Procurement Platform (EKAP). It automates the process of finding tenders based on specific criteria, extracting detailed information for each, cleaning and filtering the data, and exporting it to CSV format for analysis, including files specifically structured for import into Neo4j.

## Features

-   **Configurable Search**: Easily define search parameters like year and city in a central `config.json` file.
-   **Multi-Step Scraping**: Performs an initial scrape to gather tender listings, followed by a detailed scrape for each entry.
-   **Automated Data Processing**: Includes built-in modules for cleaning, filtering, and structuring the scraped data.
-   **Automated Captcha Solving**: Integrates with 2Captcha to solve captchas automatically (requires an API key).
-   **CSV Export**: Generates a main CSV file with all filtered projects and separate files for Neo4j import (projects, administrations, contractors, locations).
-   **Caching**: Caches the results of the initial and full scrapes to `initial-scrape.json` and `full-scrape.json` respectively, allowing you to re-run the cleaning, filtering, and exporting steps without having to re-scrape the data every time.

## Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v16 or higher recommended)
-   npm (included with Node.js)

### 1. Installation

Clone the repository and install the required dependencies:

```bash
git clone https://github.com/your-username/your-repo.git
cd your-repo
npm install
```

### 2. Configuration

Before running the application, you need to configure the scraper by editing the `config.json` file:

```json
{
  "search": {
    "ihaleTuru": 2,
    "ilId": 31,
    "iknYil": 2023,
    "ilLabel": "HATAY"
  },
  "headless": true,
  "dataDir": "data",
  "captcha": {
    "autoSolve": false,
    "apiKey": "YOUR_API_KEY_HERE"
  }
}
```

-   `search`: Defines the criteria for the tender search.
    -   `iknYil`: The year of the tender.
    -   `ilId`: The city ID.
    -   `ilLabel`: The city name label used for filtering.
-   `headless`: Set to `true` to run the browser in the background, or `false` to watch the scraper in action.
-   `dataDir`: The directory where all data files (JSON, CSV) will be saved.
-   `captcha`:
    -   `autoSolve`: Set to `true` to enable automatic captcha solving.
    -   `apiKey`: If `autoSolve` is true, you **must** provide a valid API key from a service like [2Captcha](https://2captcha.com/).

### 3. Running the Scraper

Once the configuration is set, you can run the application with a single command:

```bash
node index.js
```

The scraper will begin processing, and you will see log messages in your terminal indicating its progress.

## Output Files

All output files are saved in the directory specified by `dataDir` in the configuration (default is `data/`).

-   **`initial-scrape.json`**: A cached JSON file containing the list of tenders found in the initial search.
-   **`full-scrape.json`**: A cached JSON file with the detailed, raw data scraped for each tender.
-   **`cleaned-data.json`**: The full scrape data after cleaning (e.g., parsing numbers and dates).
-   **`filtered-data.json`**: The cleaned data after applying the project's specific filters (e.g., post-earthquake, not cancelled).
-   **`projects.csv`**: The final, main CSV export of the filtered tender data.
-   **`neo4j/`**: A directory containing CSV files formatted for Neo4j:
    -   `projects.csv`
    -   `admins.csv`
    -   `contractors.csv`
    -   `locations.csv`
-   **`captcha.png`**: A temporary image of the captcha, saved if auto-solving is attempted.