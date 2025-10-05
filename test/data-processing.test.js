const { cleanData } = require('../src/cleaner');
const { filterData } = require('../src/filter');

describe('Data Processing', () => {
  describe('Cleaner', () => {
    it('should parse TRY currency strings correctly', () => {
      const data = [{ 'Yaklaşık Maliyet': '1.234.567,89 TRY' }];
      const cleaned = cleanData(data);
      expect(cleaned[0]['Yaklaşık Maliyet_parsed']).toBe(1234567.89);
    });

    it('should split location and datetime strings correctly', () => {
      const data = [{ 'İhale Yeri ve Tarihi': 'Antakya - 20.02.2023 10:00' }];
      const cleaned = cleanData(data);
      expect(cleaned[0]['İhale Yeri']).toBe('Antakya');
      expect(cleaned[0]['İhale Tarihi']).toBe('2023-02-20T10:00:00.000Z');
    });
  });

  describe('Filter', () => {
    const baseItem = {
      'İhale Türü - Usulü': 'Yapım - Pazarlık - Pazarlık (MD 21 B)',
      'İhale Durumu': 'Sonuçlanmış',
      'İhale Onay Tarihi': '15.02.2023'
    };

    it('should keep items that match all criteria', () => {
      const data = [baseItem];
      const filtered = filterData(data);
      expect(filtered).toHaveLength(1);
    });

    it('should filter out items with the wrong procedure', () => {
      const data = [{ ...baseItem, 'İhale Türü - Usulü': 'Mal Alımı' }];
      const filtered = filterData(data);
      expect(filtered).toHaveLength(0);
    });

    it('should filter out cancelled items', () => {
      const data = [{ ...baseItem, 'İhale Durumu': 'İhale İptal Edilmiş' }];
      const filtered = filterData(data);
      expect(filtered).toHaveLength(0);
    });

    it('should filter out items before the earthquake cutoff date', () => {
      const data = [{ ...baseItem, 'İhale Onay Tarihi': '01.01.2023' }];
      const filtered = filterData(data);
      expect(filtered).toHaveLength(0);
    });
  });
});