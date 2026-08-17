import writeXlsxFile, { type SheetData } from 'write-excel-file/browser';

function normalizeCell(value: unknown): string | number | boolean | Date | null {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date
  ) {
    return value;
  }

  return value == null ? null : String(value);
}

export async function downloadSpreadsheet(
  rows: unknown[][],
  columns: string[],
  sheetName: string,
  fileName: string,
) {
  const sheetData: SheetData = rows.map((row) => row.map(normalizeCell));
  const workbook = writeXlsxFile(sheetData, {
    sheet: sheetName.replace(/[\\/?*:[\]]/g, ' ').slice(0, 31) || 'Export',
    columns: columns.map((heading) => ({ width: Math.max(heading.length * 2, 12) })),
  });

  await workbook.toFile(fileName);
}
