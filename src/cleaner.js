const fs = require('fs');
const path = require('path');

// Conversion propre des montants TRY
function parseTRY(value) {
  if (!value || typeof value !== 'string') return null;
  const clean = value.replace(/[.]/g, '').replace(',', '.').replace(/\s*TRY\s*/i, '');
  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

// Extraction lieu + date à partir de la chaîne type : "Antakya - 20.02.2023 10:00"
function splitLocationDatetime(locStr) {
  if (!locStr || typeof locStr !== 'string') return { location: null, datetime: null };
  const lastDash = locStr.lastIndexOf('-');
  if (lastDash === -1) return { location: locStr.trim(), datetime: null };

  const location = locStr.slice(0, lastDash).trim();
  const dateTimeStr = locStr.slice(lastDash + 1).trim();

  const parts = dateTimeStr.split(' ');
  if (parts.length !== 2) return { location, datetime: null };

  const datePart = parts[0];
  const timePart = parts[1];

  const dateComponents = datePart.split('.');
  if (dateComponents.length !== 3) return { location, datetime: null };

  const [dd, mm, yyyy] = dateComponents;

  const isoStr = `${yyyy}-${mm}-${dd}T${timePart}`;
  const dateObj = new Date(isoStr);

  return {
    location,
    datetime: isNaN(dateObj.getTime()) ? null : dateObj.toISOString()
  };
}

function cleanData(tenders) {
  return tenders.map(t => {
    const out = { ...t };

    // Nettoyage des prix
    const moneyFields = ['Yaklaşık Maliyet', 'En Düşük Teklif', 'En Yüksek Teklif'];
    moneyFields.forEach(field => {
      const raw = t[field];
      if (raw) {
        out[`${field}_parsed`] = parseTRY(raw);
      }
    });

    // Nettoyage lieu + date
    const locInfo = t['İhale Yeri ve Tarihi'] || '';
    const { location, datetime } = splitLocationDatetime(locInfo);
    out['İhale Yeri'] = location;
    out['İhale Tarihi'] = datetime;

    return out;
  });
}

module.exports = { cleanData };