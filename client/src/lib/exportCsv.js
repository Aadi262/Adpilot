/**
 * exportToCSV — shared CSV export utility
 * @param {Object[]} data       - array of row objects
 * @param {string[]} columns    - ordered array of field names (keys)
 * @param {string}   filename   - output filename (without .csv)
 * @param {Object}   [headers]  - optional map of field → display label
 */
export function exportToCSV(data, columns, filename, headers = {}) {
  if (!data?.length) return;

  const headerRow = columns.map(c => headers[c] ?? c).join(',');
  const rows = data.map(row =>
    columns.map(col => {
      const raw = row[col];
      const val = raw == null ? '' : raw;
      const str = String(val)
        .replace(/\u2014/g, '')
        .replace(/\u2013/g, '-')
        .replace(/"/g, '""');
      return str.includes(',') || str.includes('\n') || str.includes('"')
        ? `"${str}"`
        : str;
    }).join(',')
  );

  // Prefix UTF-8 BOM so Excel opens the file with the correct encoding.
  const csv = ['\uFEFF' + headerRow, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
