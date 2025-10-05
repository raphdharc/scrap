const EARTHQUAKE_CUTOFF = new Date('2023-02-06');

function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.trim().split('.');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  return new Date(`${yyyy}-${mm}-${dd}`);
}

function filterData(data) {
  return data.filter(item => {
    const procedureMatch = item['İhale Türü - Usulü'] === 'Yapım - Pazarlık - Pazarlık (MD 21 B)';
    const notCancelled = item['İhale Durumu'] !== 'İhale İptal Edilmiş';
    const onayDate = parseDate(item['İhale Onay Tarihi']);
    const afterQuake = onayDate && onayDate >= EARTHQUAKE_CUTOFF;

    return procedureMatch && notCancelled && afterQuake;
  });
}

module.exports = { filterData };