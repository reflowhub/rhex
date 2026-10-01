// ---------------------------------------------------------------------------
// Device manifest CSV parsing — shared by business and partner bulk estimates
// ---------------------------------------------------------------------------

/** Split one CSV line into trimmed fields, handling quoted fields and "" escapes. */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// Column synonyms for auto-detection
const DEVICE_SYNONYMS = ["device", "model", "phone", "handset", "product", "description", "item", "name"];
const QUANTITY_SYNONYMS = ["quantity", "qty", "count", "units", "amount"];
const STORAGE_SYNONYMS = ["storage", "capacity", "memory", "size", "gb"];
const MAKE_SYNONYMS = ["make", "brand", "manufacturer", "oem"];
const GRADE_SYNONYMS = ["grade", "condition", "quality", "tier"];

/** Index of the first header matching a synonym exactly, then partially; -1 if none. */
export function findColumnIndex(headers: string[], synonyms: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const syn of synonyms) {
    const idx = lower.indexOf(syn);
    if (idx !== -1) return idx;
  }
  // Partial match
  for (const syn of synonyms) {
    const idx = lower.findIndex((h) => h.includes(syn));
    if (idx !== -1) return idx;
  }
  return -1;
}

export interface ManifestRow {
  /** Device description with make/storage columns folded in, for matching */
  rawInput: string;
  quantity: number;
  /** Row grade if valid for the category, otherwise the default grade */
  grade: string;
}

/**
 * Parse a manifest CSV (header row + data rows) into device rows.
 * Columns are auto-detected from the header; rows without a device are skipped.
 *
 * @returns the rows, or null if the CSV has no data rows
 */
export function parseManifestRows(
  csv: string,
  validGrades: string[],
  defaultGrade: string
): ManifestRow[] | null {
  const lines = csv
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  if (lines.length < 2) return null;

  const headers = parseCSVLine(lines[0]);
  const deviceCol = findColumnIndex(headers, DEVICE_SYNONYMS);
  const quantityCol = findColumnIndex(headers, QUANTITY_SYNONYMS);
  const storageCol = findColumnIndex(headers, STORAGE_SYNONYMS);
  const makeCol = findColumnIndex(headers, MAKE_SYNONYMS);
  const gradeCol = findColumnIndex(headers, GRADE_SYNONYMS);
  const effectiveDeviceCol = deviceCol >= 0 ? deviceCol : 0;

  const rows: ManifestRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.every((v) => !v.trim())) continue; // skip empty rows

    // Build raw input string
    let rawInput = values[effectiveDeviceCol] || "";
    if (makeCol >= 0 && values[makeCol]) rawInput = `${values[makeCol]} ${rawInput}`;
    if (storageCol >= 0 && values[storageCol]) rawInput = `${rawInput} ${values[storageCol]}`;
    rawInput = rawInput.trim();
    if (!rawInput) continue;

    // Parse quantity
    let quantity = 1;
    if (quantityCol >= 0 && values[quantityCol]) {
      const parsed = parseInt(values[quantityCol], 10);
      if (!isNaN(parsed) && parsed > 0) quantity = parsed;
    }

    // Parse per-row grade (fall back to the default grade)
    let grade = defaultGrade;
    if (gradeCol >= 0 && values[gradeCol]) {
      const g = values[gradeCol].trim().toUpperCase();
      if (validGrades.includes(g)) grade = g;
    }

    rows.push({ rawInput, quantity, grade });
  }
  return rows;
}
