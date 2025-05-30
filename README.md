
## 🚀 Pipeline Overview

### 1. `ekap-hatay-2023.js` – Scrape Initial Tender List

- **Input**: None (scrapes directly from EKAP)
- **Output**: `ekap-hatay-2023.json`
- **Description**: Collects IKNs and basic metadata for all 2023 construction tenders in Hatay province.

### 2. `ekap-full-scrapper.js` – Detailed Tender Extraction

- **Input**: `ekap-hatay-2023.json`
- **Output**: `ekap-results.json`
- **Description**: For each IKN, scrapes all detailed information from the tender detail iframe (`BirBakistaIhale.aspx`).

### 3. `clean-ekap.js` – Data Cleaning and Enrichment

- **Input**: `ekap-results.json`
- **Output**: `ekap-cleaned.json`
- **Description**: Cleans and formats key fields (prices, procedures). Calculates added metrics (e.g., price difference between highest and lowest bid).

### 4. `filter-ekap.js` – Targeted Filtering

- **Input**: `ekap-cleaned.json`
- **Output**: `ekap-filtered.json`
- **Filters**:
  - Must be post-earthquake (custom logic)
  - Must not be canceled
  - Must use procedure **21B**

### 5. `export-csv.js` – Final Export

- **Input**: `ekap-filtered.json`
- **Output**:
  - `ekap-full.csv` (main folder): All data in tabular format
  - `neo4j_csv/`: CSV files for graph database import:
    - `Administration.csv`
    - `Procedures.csv`
    - `Projects.csv`
    - `Relations.csv`


# scrap
