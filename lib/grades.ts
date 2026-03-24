/**
 * Shared grade constants and helpers.
 */

export const GRADES = ["A", "B", "C", "D", "E"] as const;
export type Grade = (typeof GRADES)[number];

/** Buy-side cosmetic-condition descriptions (shown to shoppers). */
export const GRADE_DESCRIPTIONS: Record<string, string> = {
  A: "Excellent condition. No visible scratches or wear.",
  B: "Good condition. Minor signs of use, barely noticeable.",
  C: "Fair condition. Some visible scratches or light wear.",
  D: "Acceptable condition. Noticeable wear and cosmetic marks.",
  E: "Poor condition. Significant wear, fully functional.",
};

/** Buy-side short labels. */
export const GRADE_LABELS: Record<string, string> = {
  A: "Excellent",
  B: "Good",
  C: "Fair",
  D: "Acceptable",
  E: "Poor",
};

/** Sell-side labels (describe the defect, not cosmetic tier). */
export const SELL_GRADE_LABELS: Record<string, string> = {
  A: "Excellent",
  B: "Good",
  C: "Fair",
  D: "Screen Issues",
  E: "No Power",
};

/** Grade badge colours (Tailwind classes). */
export const GRADE_COLORS: Record<string, string> = {
  A: "bg-green-100 text-green-800 border-green-200",
  B: "bg-blue-100 text-blue-800 border-blue-200",
  C: "bg-yellow-100 text-yellow-800 border-yellow-200",
  D: "bg-orange-100 text-orange-800 border-orange-200",
  E: "bg-red-100 text-red-800 border-red-200",
};

/**
 * Read grade prices from Firestore documents.
 * Supports both the legacy format ({ gradeA: 750, gradeB: 525, ... })
 * and the new map format ({ grades: { A: 750, B: 525, ... } }).
 */

export function readGrades(
  data: Record<string, unknown>
): Record<string, number> {
  // New format: { grades: { A: 750, B: 525, ... } }
  if (data.grades && typeof data.grades === "object") {
    const grades: Record<string, number> = {};
    for (const [key, val] of Object.entries(
      data.grades as Record<string, unknown>
    )) {
      if (val !== undefined && val !== null) {
        grades[key] = Number(val);
      }
    }
    return grades;
  }

  // Legacy format: { gradeA: 750, gradeB: 525, ... }
  const grades: Record<string, number> = {};
  for (const g of ["A", "B", "C", "D", "E"]) {
    const field = `grade${g}`;
    if (data[field] !== undefined && data[field] !== null) {
      grades[g] = Number(data[field]);
    }
  }
  return grades;
}
