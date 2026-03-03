import * as XLSX from "xlsx";

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface ParsedExcel {
  sheetNames: string[];
  sheets: Record<string, ParsedSheet>;
}

export function parseExcelBuffer(buffer: Buffer): ParsedExcel {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheets: Record<string, ParsedSheet> = {};

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    const headers = json.length > 0 ? Object.keys(json[0]) : [];
    sheets[name] = { headers, rows: json };
  }

  return { sheetNames: workbook.SheetNames, sheets };
}
