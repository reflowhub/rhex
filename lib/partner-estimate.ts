import { adminDb } from "@/lib/firebase-admin";
import { getDevices } from "@/lib/device-cache";
import { matchDeviceString, loadDeviceLibrary } from "@/lib/matching";
import { parseManifestRows } from "@/lib/manifest-csv";
import { calculatePartnerRate } from "@/lib/partner-pricing";
import { readGrades } from "@/lib/grades";
import { getActivePriceList, getCategoryGrades } from "@/lib/categories";

// ---------------------------------------------------------------------------
// Partner bulk estimates (Mode B) — shared by the portal and the v1 API
// ---------------------------------------------------------------------------

export const MAX_ESTIMATE_ROWS = 2000;
export const MAX_LINE_QUANTITY = 10000;

/** Input problem the caller should return to the client with `status`. */
export class EstimateError extends Error {
  constructor(message: string, public status: number = 400) {
    super(message);
  }
}

export interface EstimateDeviceInput {
  deviceId?: unknown;
  deviceName?: unknown;
  quantity?: unknown;
  grade?: unknown;
}

export interface EstimateLine {
  rawInput: string;
  deviceId: string | null;
  deviceName: string | null;
  matchConfidence: "high" | "medium" | "low" | "exact";
  quantity: number;
  assumedGrade: string;
  indicativePriceNZD: number;
  publicPriceNZD: number;
}

export interface PartnerEstimate {
  type: "buildList" | "manifest";
  category: string;
  assumedGrade: string;
  lines: EstimateLine[];
  totalDevices: number;
  totalIndicativeNZD: number;
  totalPublicNZD: number;
  matchedCount: number;
  unmatchedCount: number;
}

/**
 * Price a manifest CSV or a list of library devices at the partner rate.
 * Throws EstimateError for invalid input.
 */
export async function buildPartnerEstimate({
  csv,
  devices,
  category: requestedCategory,
  assumedGrade,
  discount,
}: {
  csv?: unknown;
  devices?: unknown;
  category?: unknown;
  assumedGrade?: unknown;
  discount: number;
}): Promise<PartnerEstimate> {
  const isDirectDevices = Array.isArray(devices) && devices.length > 0;
  if (!isDirectDevices && (!csv || typeof csv !== "string")) {
    throw new EstimateError("csv or devices is required");
  }

  // Determine category and load valid grades
  const category = (typeof requestedCategory === "string" && requestedCategory) || "Phone";
  const categoryGrades = await getCategoryGrades(category);
  const validGrades =
    categoryGrades.length > 0
      ? categoryGrades.map((g) => g.key)
      : ["A", "B", "C", "D", "E"];

  const grade = String(
    assumedGrade || validGrades[Math.floor(validGrades.length / 2)] || "C"
  ).toUpperCase();
  if (!validGrades.includes(grade)) {
    throw new EstimateError(`Invalid grade "${grade}" for ${category}`);
  }

  // Lookup active price list for this category
  const priceListId = await getActivePriceList(category);
  if (!priceListId) {
    throw new EstimateError(`No pricing available for category "${category}"`, 404);
  }

  const priceSnapshot = await adminDb
    .collection(`priceLists/${priceListId}/prices`)
    .get();
  const priceMap = new Map<string, Record<string, number>>();
  priceSnapshot.docs.forEach((doc) => {
    priceMap.set(doc.id, readGrades(doc.data()));
  });

  const lines: EstimateLine[] = [];
  let totalIndicativeNZD = 0;
  let totalPublicNZD = 0;
  let matchedCount = 0;
  let unmatchedCount = 0;

  const addLine = (
    line: Omit<EstimateLine, "indicativePriceNZD" | "publicPriceNZD">
  ) => {
    if (line.quantity > MAX_LINE_QUANTITY) {
      throw new EstimateError(
        `Quantity per line can't exceed ${MAX_LINE_QUANTITY.toLocaleString("en-AU")}`
      );
    }

    let publicPriceNZD = 0;
    let indicativePriceNZD = 0;
    if (line.deviceId) {
      const price = priceMap.get(line.deviceId)?.[line.assumedGrade];
      if (price !== undefined) {
        publicPriceNZD = price * line.quantity;
        indicativePriceNZD = calculatePartnerRate(price, discount) * line.quantity;
      }
      matchedCount++;
    } else {
      unmatchedCount++;
    }

    totalIndicativeNZD += indicativePriceNZD;
    totalPublicNZD += publicPriceNZD;
    lines.push({ ...line, indicativePriceNZD, publicPriceNZD });
  };

  if (isDirectDevices) {
    // Build List mode — devices selected directly from the library
    const deviceInputs = devices as EstimateDeviceInput[];
    if (deviceInputs.length > MAX_ESTIMATE_ROWS) {
      throw new EstimateError(`Too many devices (max ${MAX_ESTIMATE_ROWS.toLocaleString("en-AU")})`);
    }

    const library = new Map((await getDevices()).map((d) => [d.id, d]));

    for (const d of deviceInputs) {
      if (!d || typeof d.deviceId !== "string" || !d.deviceId) continue;

      const quantity = Math.max(1, parseInt(String(d.quantity), 10) || 1);
      const requestedGrade = typeof d.grade === "string" ? d.grade.toUpperCase() : "";
      const rowGrade = validGrades.includes(requestedGrade) ? requestedGrade : grade;

      // Only active devices in this category can be priced
      const libraryDevice = library.get(d.deviceId);
      const device =
        libraryDevice?.active && libraryDevice.category === category
          ? libraryDevice
          : null;
      const clientName = typeof d.deviceName === "string" ? d.deviceName.trim() : "";

      addLine(
        device
          ? {
              rawInput: clientName || `${device.make} ${device.model} ${device.storage}`,
              deviceId: device.id,
              deviceName: `${device.make} ${device.model} ${device.storage}`,
              matchConfidence: "exact",
              quantity,
              assumedGrade: rowGrade,
            }
          : {
              rawInput: clientName || d.deviceId,
              deviceId: null,
              deviceName: null,
              matchConfidence: "low",
              quantity,
              assumedGrade: rowGrade,
            }
      );
    }
  } else {
    // CSV/manifest mode — match device strings
    const rows = parseManifestRows(csv as string, validGrades, grade);
    if (!rows) {
      throw new EstimateError("CSV must have at least a header row and one data row");
    }
    if (rows.length > MAX_ESTIMATE_ROWS) {
      throw new EstimateError(`Too many rows (max ${MAX_ESTIMATE_ROWS.toLocaleString("en-AU")})`);
    }

    await loadDeviceLibrary();

    for (const row of rows) {
      const match = await matchDeviceString(row.rawInput);
      addLine({
        rawInput: row.rawInput,
        deviceId: match.deviceId,
        deviceName: match.deviceName,
        matchConfidence: match.matchConfidence,
        quantity: row.quantity,
        assumedGrade: row.grade,
      });
    }
  }

  if (lines.length === 0) {
    throw new EstimateError("No valid device rows found");
  }

  return {
    type: isDirectDevices ? "buildList" : "manifest",
    category,
    assumedGrade: grade,
    lines,
    totalDevices: lines.reduce((sum, l) => sum + l.quantity, 0),
    totalIndicativeNZD,
    totalPublicNZD,
    matchedCount,
    unmatchedCount,
  };
}
