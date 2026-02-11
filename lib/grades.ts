/**
 * Shared helper for reading grade prices from Firestore documents.
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
